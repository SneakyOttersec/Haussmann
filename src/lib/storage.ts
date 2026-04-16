import type { DonneesApp } from '@/types';
import { putBlob, getBlob } from './blobstore';
import { extractAllDocuments, dataUriToBytes } from './doc-extract';

const STORAGE_KEY = 'haussmann-data';
const LEGACY_STORAGE_KEY = 'sci-immobilier-data';

function getDefaultData(): DonneesApp {
  return {
    biens: [],
    depenses: [],
    revenus: [],
    prets: [],
    interventions: [],
    contacts: [],
    documents: [],
    lots: [],
    suiviLoyers: [],
    paiementsCharges: [],
    settings: {
      regimeFiscal: 'IR',
      nomSCI: 'Ma SCI',
      associes: [
        { id: '1', nom: 'Associe 1', quotePart: 50 },
        { id: '2', nom: 'Associe 2', quotePart: 50 },
      ],
    },
  };
}

/**
 * Renomme les anciens noms de cles top-level (propres a l'avant-refactor FR
 * de 2026) vers leurs equivalents francais. Operation idempotente : si les
 * nouvelles cles existent deja, les anciennes sont juste ignorees.
 *
 * Ancien        → Nouveau
 * properties    → biens
 * expenses      → depenses
 * incomes       → revenus
 * loans         → prets
 * rentTracking  → suiviLoyers
 * chargePayments → paiementsCharges
 *
 * Egalement les champs propertyId → bienId et expenseId → depenseId sur
 * toutes les entites concernees.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateLegacyKeys(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const data = { ...raw };
  // Top-level renames
  const TOPLEVEL_RENAMES: Array<[string, string]> = [
    ['properties', 'biens'],
    ['expenses', 'depenses'],
    ['incomes', 'revenus'],
    ['loans', 'prets'],
    ['rentTracking', 'suiviLoyers'],
    ['chargePayments', 'paiementsCharges'],
  ];
  for (const [oldKey, newKey] of TOPLEVEL_RENAMES) {
    if (data[oldKey] !== undefined && data[newKey] === undefined) {
      data[newKey] = data[oldKey];
      delete data[oldKey];
    }
  }
  // Per-entity field renames : propertyId → bienId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renamePropertyId = (arr: any[] | undefined) => (arr ?? []).map((it) => {
    if (it && typeof it === 'object' && 'propertyId' in it && !('bienId' in it)) {
      const { propertyId, ...rest } = it;
      return { ...rest, bienId: propertyId };
    }
    return it;
  });
  data.depenses = renamePropertyId(data.depenses);
  data.revenus = renamePropertyId(data.revenus);
  data.prets = renamePropertyId(data.prets);
  data.interventions = renamePropertyId(data.interventions);
  data.contacts = renamePropertyId(data.contacts);
  data.documents = renamePropertyId(data.documents);
  data.lots = renamePropertyId(data.lots);
  data.suiviLoyers = renamePropertyId(data.suiviLoyers);
  data.paiementsCharges = renamePropertyId(data.paiementsCharges);
  // expenseId → depenseId on PaiementCharge
  data.paiementsCharges = (data.paiementsCharges ?? []).map((p: Record<string, unknown>) => {
    if ('expenseId' in p && !('depenseId' in p)) {
      const { expenseId, ...rest } = p;
      return { ...rest, depenseId: expenseId };
    }
    return p;
  });
  return data;
}

function migrateData(data: DonneesApp): DonneesApp {
  data.biens = (data.biens ?? []).map((p) => {
    const migrated = { ...p };
    if (migrated.fraisAgence == null) migrated.fraisAgence = 0;
    if (migrated.fraisDossier == null) migrated.fraisDossier = 0;
    if (migrated.fraisCourtage == null) migrated.fraisCourtage = 0;
    if (migrated.montantMobilier == null) migrated.montantMobilier = 0;
    // Migrate legacy dateAchat → dateSaisie
    if ('dateAchat' in migrated && !migrated.dateSaisie) {
      migrated.dateSaisie = (migrated as Record<string, unknown>).dateAchat as string;
      delete (migrated as Record<string, unknown>).dateAchat;
    }
    return migrated;
  });
  data.interventions = data.interventions ?? [];
  data.contacts = data.contacts ?? [];
  data.documents = data.documents ?? [];
  data.suiviLoyers = data.suiviLoyers ?? [];
  data.paiementsCharges = data.paiementsCharges ?? [];
  data.lots = (data.lots ?? []).map((l) => {
    const migrated = { ...l };
    if (!migrated.historiqueLoyers) {
      migrated.historiqueLoyers = [{ id: '0', date: new Date().toISOString().slice(0, 10), montant: migrated.loyerMensuel }];
    }
    return migrated;
  });
  if (!data.settings.associes) {
    data.settings.associes = [
      { id: '1', nom: 'Associe 1', quotePart: 50 },
      { id: '2', nom: 'Associe 2', quotePart: 50 },
    ];
  }
  return data;
}

// ── Blob extraction: move large base64 data URIs out of localStorage into IndexedDB ──

const BLOB_PLACEHOLDER = '__idb:';

interface BlobRef {
  key: string;
  data: string;
  writePlaceholder: () => void;
}

function isDataUri(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith('data:');
}

/** Extract all base64 data URIs from DonneesApp, replacing them with IDB placeholders */
function extractBlobs(data: DonneesApp): BlobRef[] {
  const refs: BlobRef[] = [];

  // Bien statusDocs
  for (const p of data.biens) {
    if (!p.statusDocs) continue;
    for (const [phase, doc] of Object.entries(p.statusDocs)) {
      if (!doc || !isDataUri(doc.data)) continue;
      const key = `prop:${p.id}:statusDoc:${phase}`;
      refs.push({ key, data: doc.data, writePlaceholder: () => { doc.data = BLOB_PLACEHOLDER + key; } });
    }
  }

  // PropertyDocuments
  for (const doc of (data.documents ?? [])) {
    if (!isDataUri(doc.data)) continue;
    const key = `doc:${doc.id}`;
    refs.push({ key, data: doc.data, writePlaceholder: () => { doc.data = BLOB_PLACEHOLDER + key; } });
  }

  // Loan documents
  for (const pret of (data.prets ?? [])) {
    for (let i = 0; i < (pret.documents ?? []).length; i++) {
      const d = pret.documents![i];
      if (!isDataUri(d.data)) continue;
      const key = `pret:${pret.id}:doc:${i}`;
      refs.push({ key, data: d.data, writePlaceholder: () => { d.data = BLOB_PLACEHOLDER + key; } });
    }
  }

  // Intervention PJ
  for (const inter of (data.interventions ?? [])) {
    if (!inter.pieceJointe || !isDataUri(inter.pieceJointe.data)) continue;
    const key = `inter:${inter.id}:pj`;
    refs.push({ key, data: inter.pieceJointe.data, writePlaceholder: () => { inter.pieceJointe!.data = BLOB_PLACEHOLDER + key; } });
  }

  return refs;
}

/** Restore all IDB placeholders back to base64 data URIs */
async function restoreBlobs(data: DonneesApp): Promise<void> {
  const restore = async (obj: { data: string }) => {
    if (typeof obj.data === 'string' && obj.data.startsWith(BLOB_PLACEHOLDER)) {
      const key = obj.data.slice(BLOB_PLACEHOLDER.length);
      const blob = await getBlob(key);
      if (blob) obj.data = blob;
    }
  };

  for (const p of data.biens) {
    if (!p.statusDocs) continue;
    for (const doc of Object.values(p.statusDocs)) {
      if (doc) await restore(doc);
    }
  }
  for (const doc of (data.documents ?? [])) { await restore(doc); }
  for (const pret of (data.prets ?? [])) {
    for (const d of (pret.documents ?? [])) { await restore(d); }
  }
  for (const inter of (data.interventions ?? [])) {
    if (inter.pieceJointe) await restore(inter.pieceJointe);
  }
}

// ── Public API ──

export function loadData(): DonneesApp {
  if (typeof window === 'undefined') return getDefaultData();
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    let fromLegacy = false;
    if (!raw) {
      // Migration de l'ancienne cle 'sci-immobilier-data' (avant le rebrand
      // Haussmann + refactor FR de 2026). On lit l'ancienne, on convertit,
      // on sauve sous la nouvelle cle, on nettoie l'ancienne.
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return getDefaultData();
      fromLegacy = true;
    }
    const parsed = JSON.parse(raw);
    const renamed = migrateLegacyKeys(parsed);
    const data = migrateData({ ...getDefaultData(), ...renamed });
    if (fromLegacy) {
      // One-shot : ecrit sous la nouvelle cle, supprime l'ancienne.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch { /* best effort */ }
    }
    return data;
  } catch {
    return getDefaultData();
  }
}

/** Load data and restore blobs from IndexedDB (async) */
export async function loadDataWithBlobs(): Promise<DonneesApp> {
  const data = loadData();
  await restoreBlobs(data);
  return data;
}

export function saveData(data: DonneesApp): void {
  if (typeof window === 'undefined') return;

  // Clone to avoid mutating in-memory state. structuredClone is the native, much faster
  // alternative to JSON.parse(JSON.stringify(...)) — meaningful with photos as data URIs.
  const clone: DonneesApp = structuredClone(data);
  const blobs = extractBlobs(clone);

  // Write blobs to IndexedDB (fire-and-forget — fast enough for small counts)
  for (const ref of blobs) {
    ref.writePlaceholder();
    putBlob(ref.key, ref.data);
  }

  // Save stripped data to localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
}

// ── Debounced save ──
//
// Form fields call setData on every keystroke, which historically meant
// structuredClone(entire-state) + localStorage.setItem on every character.
// We coalesce rapid writes into a single flush ~250 ms after the last call,
// while keeping a hard guarantee that data is flushed on tab unload / hidden.

const SAVE_DEBOUNCE_MS = 250;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingData: DonneesApp | null = null;

function flushPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (pendingData) {
    const data = pendingData;
    pendingData = null;
    saveData(data);
  }
}

export function saveDataDebounced(data: DonneesApp): void {
  if (typeof window === 'undefined') return;
  pendingData = data;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(flushPendingSave, SAVE_DEBOUNCE_MS);
}

/** Force any pending debounced save to flush immediately. Safe to call from unload handlers. */
export function flushSave(): void {
  flushPendingSave();
}

// Best-effort durability: flush on tab close / page hide. `pagehide` covers iOS Safari
// and bfcache scenarios where `beforeunload` doesn't fire.
if (typeof window !== 'undefined') {
  const flushOnExit = () => flushPendingSave();
  window.addEventListener('beforeunload', flushOnExit);
  window.addEventListener('pagehide', flushOnExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSave();
  });
}

const EXPORT_VERSION = 2;

export function exportData(): string {
  return JSON.stringify({
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: loadData(),
  }, null, 2);
}

export function importData(json: string): DonneesApp {
  const parsed = JSON.parse(json);
  const raw = parsed.version && parsed.data ? parsed.data : parsed;
  const merged = migrateData({ ...getDefaultData(), ...raw });
  saveData(merged);
  return merged;
}

/**
 * Export as a ZIP with organized folder structure:
 * Haussmann/
 * ├── Documents/{NomBien} - Phases/...
 * ├── Documents/{NomBien} - Documents/...
 * └── haussmann-backup.json
 */
export async function exportDataAsZip(data: DonneesApp): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const root = 'Haussmann';

  // Extract documents and add to zip as real files
  const docs = extractAllDocuments(data, root);
  for (const doc of docs) {
    const path = `${doc.folderPath}/${doc.fileName}`;
    zip.file(path, dataUriToBytes(doc.dataUri));
  }

  // Add JSON backup (full data with base64 — self-contained)
  const envelope = JSON.stringify({ version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
  zip.file(`${root}/haussmann-backup.json`, envelope);

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** Import from a ZIP — find and parse haussmann-backup.json inside */
export async function importDataFromZip(file: File): Promise<DonneesApp> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  // Find the JSON backup
  const jsonFile = Object.keys(zip.files).find(name => name.endsWith('haussmann-backup.json'));
  if (!jsonFile) throw new Error('haussmann-backup.json introuvable dans le ZIP');

  const json = await zip.files[jsonFile].async('string');
  return importData(json);
}
