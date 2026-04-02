import type { CalculatorInputs, SavedSimulation, Attachment } from '@/types';
import { putBlob, getBlob, deleteBlob, deleteBlobsWithPrefix } from './blobstore';

const STORAGE_KEY = 'sci-immobilier-simulations';

// Keys for IndexedDB blobs
function photoKey(simId: string) { return `sim:${simId}:photo`; }
function attachKey(simId: string, attId: string) { return `sim:${simId}:att:${attId}`; }

/** Strip large data (photo, attachment blobs) from inputs before localStorage */
function stripForStorage(inputs: CalculatorInputs): CalculatorInputs {
  return {
    ...inputs,
    photo: inputs.photo ? '__blob__' : '',
    attachments: (inputs.attachments ?? []).map((a) => ({
      ...a,
      data: '__blob__',
    })),
  };
}

export function loadSimulations(): SavedSimulation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(simulations: SavedSimulation[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(simulations));
}

export async function saveSimulation(nom: string, inputs: CalculatorInputs, existingId?: string | null): Promise<SavedSimulation> {
  const sims = loadSimulations();
  const id = existingId && sims.some((s) => s.id === existingId) ? existingId : crypto.randomUUID();

  // Store blobs in IndexedDB
  if (inputs.photo) {
    await putBlob(photoKey(id), inputs.photo);
  }
  for (const att of inputs.attachments ?? []) {
    if (att.data && att.data !== '__blob__') {
      await putBlob(attachKey(id, att.id), att.data);
    }
  }

  const sim: SavedSimulation = {
    id,
    nom: nom || `Simulation ${sims.length + 1}`,
    inputs: stripForStorage(inputs),
    savedAt: new Date().toISOString(),
  };

  const existingIdx = sims.findIndex((s) => s.id === id);
  if (existingIdx >= 0) {
    sims[existingIdx] = sim;
  } else {
    sims.push(sim);
  }
  saveAll(sims);
  return sim;
}

/** Restore blobs from IndexedDB into a simulation's inputs */
export async function hydrateSimulation(sim: SavedSimulation): Promise<CalculatorInputs> {
  const inputs = { ...sim.inputs };

  // Restore photo
  if (inputs.photo === '__blob__') {
    inputs.photo = (await getBlob(photoKey(sim.id))) ?? '';
  }

  // Restore attachments
  if (inputs.attachments) {
    inputs.attachments = await Promise.all(
      inputs.attachments.map(async (a: Attachment) => {
        if (a.data === '__blob__') {
          const data = await getBlob(attachKey(sim.id, a.id));
          return { ...a, data: data ?? '' };
        }
        return a;
      })
    );
  }

  return inputs;
}

export async function deleteSimulation(id: string): Promise<void> {
  const sims = loadSimulations().filter((s) => s.id !== id);
  saveAll(sims);
  // Clean up blobs
  await deleteBlobsWithPrefix(`sim:${id}:`);
}

export async function exportSimulations(): Promise<string> {
  const sims = loadSimulations();
  // Hydrate all blobs back into the export data
  const hydrated = await Promise.all(
    sims.map(async (sim) => {
      const inputs = await hydrateSimulation(sim);
      return { ...sim, inputs };
    })
  );
  return JSON.stringify(hydrated, null, 2);
}

export async function importSimulations(json: string): Promise<SavedSimulation[]> {
  const imported = JSON.parse(json);
  if (!Array.isArray(imported)) throw new Error('Format invalide');
  const existing = loadSimulations();
  const existingIds = new Set(existing.map((s) => s.id));
  const newSims = imported.filter((s: SavedSimulation) => !existingIds.has(s.id));

  // Store blobs in IndexedDB for each new simulation
  for (const sim of newSims) {
    if (sim.inputs.photo && sim.inputs.photo !== '__blob__') {
      await putBlob(photoKey(sim.id), sim.inputs.photo);
    }
    for (const att of sim.inputs.attachments ?? []) {
      if (att.data && att.data !== '__blob__') {
        await putBlob(attachKey(sim.id, att.id), att.data);
      }
    }
  }

  // Strip blobs before saving to localStorage
  const strippedNew = newSims.map((sim) => ({
    ...sim,
    inputs: stripForStorage(sim.inputs),
  }));

  const merged = [...existing, ...strippedNew];
  saveAll(merged);
  return merged;
}
