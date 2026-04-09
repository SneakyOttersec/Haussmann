/**
 * Google Drive sync with organized folder structure:
 *
 * Haussmann/
 * ├── Documents/
 * │   ├── {NomBien} - Phases/
 * │   │   ├── compromis - offre_achat.pdf
 * │   │   └── acte - acte_notarie.pdf
 * │   ├── {NomBien} - Documents/
 * │   │   └── facture - electricien.pdf
 * │   ├── {NomBien} - Prets/
 * │   │   └── offre_pret.pdf
 * │   └── {NomBien} - Interventions/
 * │       └── devis_toiture.pdf
 * └── haussmann-backup.json   (stripped of base64, contains __gdrive:{id}__ markers)
 */

import type { AppData } from '@/types';
import { extractAllDocuments } from './doc-extract';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const ROOT_FOLDER = 'Haussmann';
const DOCS_FOLDER = 'Documents';
const FILE_NAME = 'haussmann-backup.json';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const GDRIVE_MARKER_RE = /^__gdrive:([^_]+)__$/;

let accessToken: string | null = null;
let gisLoaded = false;

// ── Load Google Identity Services ──

function loadGisScript(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      gisLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Impossible de charger Google Identity Services'));
    document.head.appendChild(script);
  });
}

// ── Auth ──

export async function signIn(clientId: string): Promise<string> {
  await loadGisScript();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: google.accounts.oauth2.TokenResponse) => {
        if (response.error) { reject(new Error(response.error)); return; }
        accessToken = response.access_token;
        resolve(accessToken);
      },
      error_callback: (err: { type: string; message?: string }) => {
        reject(new Error(err.message ?? err.type));
      },
    });
    client.requestAccessToken();
  });
}

export function isSignedIn(): boolean { return accessToken !== null; }

export function signOut(): void {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
    accessToken = null;
  }
}

function ensureAuth(): string {
  if (!accessToken) throw new Error('Non connecte a Google');
  return accessToken;
}

// ── Drive primitives ──

async function driveGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = ensureAuth();
  const url = new URL(`${DRIVE_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function createDriveFolder(name: string, parentId: string): Promise<string> {
  const token = ensureAuth();
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`Create folder failed: ${await res.text()}`);
  return (await res.json()).id;
}

// Folder cache: "path" -> driveId (avoids redundant API calls within one sync)
const folderCache: Record<string, string> = {};

/** Ensure a nested folder path exists (e.g. "Haussmann/Documents/Thiers - Phases") */
async function ensureFolder(path: string): Promise<string> {
  if (folderCache[path]) return folderCache[path];

  const parts = path.split('/');
  let parentId = 'root';
  let current = '';

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (folderCache[current]) { parentId = folderCache[current]; continue; }

    const q = `name='${part.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const list = await driveGet<{ files: { id: string }[] }>('/files', { q, fields: 'files(id)' });

    if (list.files.length > 0) {
      parentId = list.files[0].id;
    } else {
      parentId = await createDriveFolder(part, parentId);
    }
    folderCache[current] = parentId;
  }
  return parentId;
}

/** Find a file by name in a folder */
async function findFile(folderId: string, name: string): Promise<string | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
  const list = await driveGet<{ files: { id: string }[] }>('/files', { q, fields: 'files(id)' });
  return list.files[0]?.id ?? null;
}

/** Upload or update a text/json file */
async function uploadTextFile(folderId: string, fileName: string, content: string, existingId?: string | null): Promise<string> {
  const token = ensureAuth();
  const metadata = existingId ? {} : { name: fileName, parents: [folderId] };
  const boundary = '---haussmann' + Date.now() + Math.random();
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata),
    `--${boundary}`, 'Content-Type: application/json', '', content,
    `--${boundary}--`,
  ].join('\r\n');

  const url = existingId
    ? `${UPLOAD_API}/files/${existingId}?uploadType=multipart`
    : `${UPLOAD_API}/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Upload text failed: ${await res.text()}`);
  return (await res.json()).id;
}

/** Upload or update a binary file from a data URI */
async function uploadBinaryFile(folderId: string, fileName: string, dataUri: string, existingId?: string | null): Promise<string> {
  const token = ensureAuth();

  // Convert data URI to Blob
  const blob = await (await fetch(dataUri)).blob();

  if (existingId) {
    // Update content only
    const res = await fetch(`${UPLOAD_API}/files/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type },
      body: blob,
    });
    if (!res.ok) throw new Error(`Update file failed: ${await res.text()}`);
    return existingId;
  }

  // Create: metadata + content via multipart
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const metaBlob = new Blob([metadata], { type: 'application/json' });

  const boundary = '---haussmann' + Date.now() + Math.random();
  const parts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    metaBlob,
    `\r\n--${boundary}\r\nContent-Type: ${blob.type}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ];
  const body = new Blob(parts);

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Create file failed: ${await res.text()}`);
  return (await res.json()).id;
}

/** Download a file and return as data URI */
async function downloadAsDataUri(fileId: string): Promise<string> {
  const token = ensureAuth();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download failed: ${await res.text()}`);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// ── Document extraction & restoration ──

/** Recursively find all __gdrive:xxx__ markers and download the files */
async function restoreMarkers(obj: Record<string, unknown> | unknown[]): Promise<void> {
  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [i, v] as const)
    : Object.entries(obj);

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      const match = value.match(GDRIVE_MARKER_RE);
      if (match) {
        try {
          (obj as Record<string | number, unknown>)[key] = await downloadAsDataUri(match[1]);
        } catch {
          // Leave marker if download fails — user can retry
        }
      }
    } else if (value && typeof value === 'object') {
      await restoreMarkers(value as Record<string, unknown>);
    }
  }
}

// ── Public API ──

export async function saveToGDrive(data: AppData): Promise<{ savedAt: string; docsUploaded: number }> {
  const clone: AppData = structuredClone(data);
  const extracted = extractAllDocuments(clone, ROOT_FOLDER);
  let docsUploaded = 0;

  // Upload each document and build a dataUri→fileId map
  const uriToMarker = new Map<string, string>();
  for (const doc of extracted) {
    try {
      const folderId = await ensureFolder(doc.folderPath);
      const existingId = await findFile(folderId, doc.fileName);
      const fileId = await uploadBinaryFile(folderId, doc.fileName, doc.dataUri, existingId);
      uriToMarker.set(doc.dataUri, `__gdrive:${fileId}__`);
      docsUploaded++;
    } catch {
      // Upload failed — base64 stays in JSON as fallback
    }
  }

  // Replace data URIs with markers in clone
  const replaceMarkers = (obj: Record<string, unknown> | unknown[]): void => {
    const entries = Array.isArray(obj) ? obj.map((v, i) => [i, v] as const) : Object.entries(obj);
    for (const [key, value] of entries) {
      if (typeof value === 'string' && uriToMarker.has(value)) {
        (obj as Record<string | number, unknown>)[key] = uriToMarker.get(value)!;
      } else if (value && typeof value === 'object') {
        replaceMarkers(value as Record<string, unknown>);
      }
    }
  };
  replaceMarkers(clone as unknown as Record<string, unknown>);

  // Upload stripped JSON
  const rootId = await ensureFolder(ROOT_FOLDER);
  const existingJson = await findFile(rootId, FILE_NAME);
  const envelope = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), data: clone }, null, 2);
  await uploadTextFile(rootId, FILE_NAME, envelope, existingJson);

  const savedAt = new Date().toISOString();
  // Clear folder cache for next sync
  Object.keys(folderCache).forEach(k => delete folderCache[k]);
  return { savedAt, docsUploaded };
}

export async function loadFromGDrive(): Promise<AppData> {
  const rootId = await ensureFolder(ROOT_FOLDER);
  const fileId = await findFile(rootId, FILE_NAME);
  if (!fileId) throw new Error('Aucune sauvegarde trouvee sur Google Drive');

  const token = ensureAuth();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download failed: ${await res.text()}`);

  const parsed = await res.json();
  const data: AppData = parsed.version && parsed.data ? parsed.data : parsed;

  // Download all documents referenced by __gdrive:xxx__ markers
  await restoreMarkers(data as unknown as Record<string, unknown>);

  Object.keys(folderCache).forEach(k => delete folderCache[k]);
  return data;
}

// ── GIS type declarations ──

declare global {
  const google: {
    accounts: {
      id: {
        initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
        prompt(): void;
      };
      oauth2: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (response: google.accounts.oauth2.TokenResponse) => void;
          error_callback?: (err: { type: string; message?: string }) => void;
        }): { requestAccessToken(): void };
        revoke(token: string, callback: () => void): void;
      };
    };
  };
  namespace google.accounts.oauth2 {
    interface TokenResponse {
      access_token: string;
      error?: string;
    }
  }
}
