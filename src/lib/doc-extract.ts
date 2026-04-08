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
