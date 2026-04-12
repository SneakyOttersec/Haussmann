/**
 * Shared document extraction logic — used by both Google Drive sync and local ZIP export.
 * Walks AppData and collects all base64 documents with organized folder paths and descriptive filenames.
 */

import type { AppData } from '@/types';
import { PROPERTY_STATUS_LABELS, DOCUMENT_CATEGORY_LABELS } from '@/types';

export interface ExtractedDoc {
  /** Folder path relative to root, e.g. "Documents/Immeuble Thiers - Phases" */
  folderPath: string;
  /** Descriptive filename, e.g. "02_04_2026_Offre_Immeuble_Thiers.pdf" */
  fileName: string;
  /** base64 data URI */
  dataUri: string;
}

export function sanitizeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim() || 'sans-nom';
}

export function isDataUri(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith('data:');
}

function getExt(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot) : '';
}

function formatDateForFile(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '_');
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '_');
}

function buildFileName(parts: { date?: string; label: string; propertyName: string; originalName: string }): string {
  const ext = getExt(parts.originalName);
  const name = [formatDateForFile(parts.date), parts.label, parts.propertyName]
    .filter(Boolean)
    .join('_')
    .replace(/\s+/g, '_');
  return sanitizeName(name) + ext;
}

/** Extract all documents from AppData with organized paths and descriptive names */
export function extractAllDocuments(data: AppData, rootFolder: string): ExtractedDoc[] {
  const docs: ExtractedDoc[] = [];
  const docsFolder = 'Documents';
  const propName = (propId: string) => sanitizeName(
    data.properties.find(p => p.id === propId)?.nom ?? propId,
  );

  // 1. Property statusDocs (phases)
  for (const p of data.properties) {
    if (!p.statusDocs) continue;
    for (const [phase, doc] of Object.entries(p.statusDocs)) {
      if (!doc || !isDataUri(doc.data)) continue;
      const phaseLabel = PROPERTY_STATUS_LABELS[phase as keyof typeof PROPERTY_STATUS_LABELS] ?? phase;
      const phaseDate = p.statusDates?.[phase as keyof typeof PROPERTY_STATUS_LABELS];
      docs.push({
        folderPath: `${rootFolder}/${docsFolder}/${sanitizeName(p.nom)} - Phases`,
        fileName: buildFileName({ date: phaseDate, label: phaseLabel, propertyName: p.nom, originalName: doc.nom }),
        dataUri: doc.data,
      });
    }
  }

  // 2. PropertyDocuments
  for (const doc of (data.documents ?? [])) {
    if (!isDataUri(doc.data)) continue;
    const pName = propName(doc.propertyId);
    const catLabel = DOCUMENT_CATEGORY_LABELS[doc.categorie] ?? doc.categorie;
    docs.push({
      folderPath: `${rootFolder}/${docsFolder}/${sanitizeName(pName)} - Documents`,
      fileName: buildFileName({ date: doc.ajouteLe, label: catLabel, propertyName: pName, originalName: doc.nom }),
      dataUri: doc.data,
    });
  }

  // 3. Loan documents
  for (const loan of (data.loans ?? [])) {
    const pName = propName(loan.propertyId);
    for (const doc of (loan.documents ?? [])) {
      if (!isDataUri(doc.data)) continue;
      docs.push({
        folderPath: `${rootFolder}/${docsFolder}/${sanitizeName(pName)} - Prets`,
        fileName: buildFileName({ date: doc.ajouteLe ?? loan.dateDebut, label: 'Pret', propertyName: pName, originalName: doc.nom }),
        dataUri: doc.data,
      });
    }
  }

  // 4. Intervention PJ
  for (const inter of (data.interventions ?? [])) {
    if (!inter.pieceJointe || !isDataUri(inter.pieceJointe.data)) continue;
    const pName = propName(inter.propertyId);
    docs.push({
      folderPath: `${rootFolder}/${docsFolder}/${sanitizeName(pName)} - Interventions`,
      fileName: buildFileName({ date: inter.date, label: 'Intervention', propertyName: pName, originalName: inter.pieceJointe.nom }),
      dataUri: inter.pieceJointe.data,
    });
  }

  return docs;
}

/** Convert a data URI to a Uint8Array (for zip or upload) */
export function dataUriToBytes(dataUri: string): Uint8Array {
  const base64 = dataUri.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Metadata-only listing (for UI display) ──

export type DocumentSource = 'phase' | 'document' | 'loan' | 'intervention';

export interface DocumentListEntry {
  /** Stable unique key for React */
  key: string;
  source: DocumentSource;
  sourceLabel: string;
  /** Source property (always defined for the 4 known sources) */
  propertyId: string;
  propertyName: string;
  /** Original uploaded filename */
  fileName: string;
  /** MIME type, e.g. "application/pdf" */
  fileType: string;
  /** Size in bytes */
  fileSize: number;
  /** ISO date — best-effort: phase date / ajouteLe / intervention date */
  date: string;
  /** Full data URI — kept so the UI can offer a download action */
  dataUri: string;
}

/**
 * Walks AppData and returns one entry per uploaded file across the 4 sources
 * (property phases, generic documents, loan PJs, intervention PJs).
 * Metadata is enough for a settings-page listing — we keep dataUri so the
 * caller can build a download link without re-walking the tree.
 */
/** Check if a document has usable data (data URI, IDB placeholder, or Drive marker). */
function hasDocData(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0;
}

export function listAllDocuments(data: AppData): DocumentListEntry[] {
  const entries: DocumentListEntry[] = [];
  const propName = (id: string) => data.properties.find((p) => p.id === id)?.nom ?? id;

  // 1. Property statusDocs (phases)
  for (const p of data.properties) {
    if (!p.statusDocs) continue;
    for (const [phase, doc] of Object.entries(p.statusDocs)) {
      if (!doc || !hasDocData(doc.data)) continue;
      const phaseLabel = PROPERTY_STATUS_LABELS[phase as keyof typeof PROPERTY_STATUS_LABELS] ?? phase;
      const phaseDate = p.statusDates?.[phase as keyof typeof PROPERTY_STATUS_LABELS] ?? '';
      entries.push({
        key: `phase:${p.id}:${phase}`,
        source: 'phase',
        sourceLabel: `Phase ${phaseLabel}`,
        propertyId: p.id,
        propertyName: p.nom,
        fileName: doc.nom,
        fileType: doc.type,
        fileSize: doc.taille,
        date: phaseDate,
        dataUri: doc.data,
      });
    }
  }

  // 2. PropertyDocuments
  for (const doc of (data.documents ?? [])) {
    if (!hasDocData(doc.data)) continue;
    const catLabel = DOCUMENT_CATEGORY_LABELS[doc.categorie] ?? doc.categorie;
    entries.push({
      key: `doc:${doc.id}`,
      source: 'document',
      sourceLabel: catLabel,
      propertyId: doc.propertyId,
      propertyName: propName(doc.propertyId),
      fileName: doc.nom,
      fileType: doc.type,
      fileSize: doc.taille,
      date: doc.ajouteLe,
      dataUri: doc.data,
    });
  }

  // 3. Loan documents
  for (const loan of (data.loans ?? [])) {
    const docs = loan.documents ?? [];
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (!hasDocData(doc.data)) continue;
      entries.push({
        key: `loan:${loan.id}:${i}`,
        source: 'loan',
        sourceLabel: 'Pret',
        propertyId: loan.propertyId,
        propertyName: propName(loan.propertyId),
        fileName: doc.nom,
        fileType: doc.type,
        fileSize: doc.taille,
        date: doc.ajouteLe ?? loan.dateDebut,
        dataUri: doc.data,
      });
    }
  }

  // 4. Intervention PJ
  for (const inter of (data.interventions ?? [])) {
    if (!inter.pieceJointe || !hasDocData(inter.pieceJointe.data)) continue;
    entries.push({
      key: `inter:${inter.id}`,
      source: 'intervention',
      sourceLabel: inter.interventionType === 'travaux' ? 'Travaux' : 'Intervention',
      propertyId: inter.propertyId,
      propertyName: propName(inter.propertyId),
      fileName: inter.pieceJointe.nom,
      fileType: inter.pieceJointe.type,
      fileSize: inter.pieceJointe.taille,
      date: inter.date,
      dataUri: inter.pieceJointe.data,
    });
  }

  // Sort by date desc (most recent first), then by filename for stability.
  entries.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.fileName.localeCompare(b.fileName);
  });

  return entries;
}

/** Format a byte count as a human-readable string (e.g. "1.2 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
