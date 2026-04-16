import type { DonneesApp } from '@/types';
import { putBlob, getBlob } from './blobstore';
import { extractAllDocuments, dataUriToBytes } from './doc-extract';

const STORAGE_KEY = 'sci-immobilier-data';

function getDefaultData(): DonneesApp {
  return {
    properties: [],
    expenses: [],
    incomes: [],
    loans: [],
    interventions: [],
    contacts: [],
    documents: [],
    lots: [],
    rentTracking: [],
    chargePayments: [],
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

function migrateData(data: DonneesApp): DonneesApp {
  data.properties = (data.properties ?? []).map((p) => {
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
  data.rentTracking = data.rentTracking ?? [];
  data.chargePayments = data.chargePayments ?? [];
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
  for (const p of data.properties) {
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
  for (const loan of (data.loans ?? [])) {
    for (let i = 0; i < (loan.documents ?? []).length; i++) {
      const d = loan.documents![i];
      if (!isDataUri(d.data)) continue;
      const key = `loan:${loan.id}:doc:${i}`;
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

  for (const p of data.properties) {
    if (!p.statusDocs) continue;
    for (const doc of Object.values(p.statusDocs)) {
      if (doc) await restore(doc);
    }
  }
  for (const doc of (data.documents ?? [])) { await restore(doc); }
  for (const loan of (data.loans ?? [])) {
    for (const d of (loan.documents ?? [])) { await restore(d); }
  }
  for (const inter of (data.interventions ?? [])) {
    if (inter.pieceJointe) await restore(inter.pieceJointe);
  }
}

// ── Public API ──

export function loadData(): DonneesApp {
  if (typeof window === 'undefined') return getDefaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    return migrateData({ ...getDefaultData(), ...JSON.parse(raw) });
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
