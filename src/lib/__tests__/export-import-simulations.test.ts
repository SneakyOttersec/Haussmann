import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimulationSauvegardee, EntreesCalculateur } from '@/types';

// ── In-memory IndexedDB blob store ──
const blobMap = new Map<string, string>();
vi.mock('@/lib/blobstore', () => ({
  putBlob: vi.fn(async (k: string, d: string) => { blobMap.set(k, d); }),
  getBlob: vi.fn(async (k: string) => blobMap.get(k) ?? null),
  deleteBlob: vi.fn(async (k: string) => { blobMap.delete(k); }),
  deleteBlobsWithPrefix: vi.fn(async (prefix: string) => {
    for (const k of [...blobMap.keys()]) if (k.startsWith(prefix)) blobMap.delete(k);
  }),
}));

// ── localStorage shim (storage.ts/simulations.ts guard on `window`) ──
const storageMap = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
  setItem: (k: string, v: string) => { storageMap.set(k, String(v)); },
  removeItem: (k: string) => { storageMap.delete(k); },
  clear: () => storageMap.clear(),
};

beforeEach(() => {
  blobMap.clear();
  storageMap.clear();
  // Truthy `window` so the `typeof window === 'undefined'` guards don't bail out.
  vi.stubGlobal('window', { addEventListener: () => {}, localStorage: localStorageShim });
  vi.stubGlobal('document', { addEventListener: () => {} });
  vi.stubGlobal('localStorage', localStorageShim);
});

const SIM_KEY = 'sci-immobilier-simulations';

function makeSim(id: string, photo?: string): SimulationSauvegardee {
  return {
    id,
    nom: `Sim ${id}`,
    inputs: { id, photo: photo ?? '', attachments: [] } as unknown as EntreesCalculateur,
    savedAt: '2026-01-01T00:00:00.000Z',
    history: [],
  };
}

describe('export/import — simulations embedded in the backup envelope', () => {
  it('round-trips a saved simulation (incl. photo blob) through export then import', async () => {
    const { exportData, importData } = await import('@/lib/storage');
    const { chargerSimulations } = await import('@/lib/simulations');
    const { getBlob } = await import('@/lib/blobstore');

    // Seed: one simulation stored stripped, its photo living in the blob store.
    storageMap.set(SIM_KEY, JSON.stringify([makeSim('sim-1', '__blob__')]));
    blobMap.set('sim:sim-1:photo', 'data:image/png;base64,AAAA');

    const json = await exportData();
    const envelope = JSON.parse(json);

    expect(envelope.version).toBe(3);
    expect(envelope.simulations).toHaveLength(1);
    // Blob is hydrated (real base64) inside the envelope so it is self-contained.
    expect(envelope.simulations[0].inputs.photo).toBe('data:image/png;base64,AAAA');

    // Simulate a fresh browser: wipe simulations + blobs.
    storageMap.delete(SIM_KEY);
    blobMap.clear();
    expect(chargerSimulations()).toHaveLength(0);

    await importData(json);

    const restored = chargerSimulations();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('sim-1');
    // Stored form is stripped again; the blob is back in IndexedDB.
    expect(restored[0].inputs.photo).toBe('__blob__');
    expect(await getBlob('sim:sim-1:photo')).toBe('data:image/png;base64,AAAA');
  });

  it('imports a legacy v2 backup (no simulations field) without wiping local sims', async () => {
    const { importData } = await import('@/lib/storage');
    const { chargerSimulations } = await import('@/lib/simulations');

    storageMap.set(SIM_KEY, JSON.stringify([makeSim('keep-me')]));

    const v2Backup = JSON.stringify({
      version: 2,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { biens: [] },
    });

    await expect(importData(v2Backup)).resolves.toBeDefined();
    expect(chargerSimulations().map((s) => s.id)).toContain('keep-me');
  });

  it('merges by id without duplicating an already-present simulation', async () => {
    const { importData, exportData } = await import('@/lib/storage');
    const { chargerSimulations } = await import('@/lib/simulations');

    storageMap.set(SIM_KEY, JSON.stringify([makeSim('sim-1'), makeSim('sim-2')]));
    const json = await exportData();

    // Drop only sim-2 locally, then re-import the full backup.
    storageMap.set(SIM_KEY, JSON.stringify([makeSim('sim-1')]));
    await importData(json);

    const ids = chargerSimulations().map((s) => s.id).sort();
    expect(ids).toEqual(['sim-1', 'sim-2']);
  });
});
