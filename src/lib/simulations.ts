import type { EntreesCalculateur, SimulationSauvegardee, SnapshotSimulation, PieceJointe } from '@/types';
import { putBlob, getBlob, deleteBlobsWithPrefix } from './blobstore';

const STORAGE_KEY = 'sci-immobilier-simulations';

/** Max number of history snapshots kept per simulation. Oldest are dropped first. */
const HISTORY_CAP = 10;
/** Minimum seconds between two history entries (prevents spam when user saves rapidly). */
const HISTORY_MIN_INTERVAL_SEC = 30;

// Keys for IndexedDB blobs
function photoKey(simId: string) { return `sim:${simId}:photo`; }
function attachKey(simId: string, attId: string) { return `sim:${simId}:att:${attId}`; }

/** Strip large data (photo, attachment blobs) from inputs before localStorage */
function stripForStorage(inputs: EntreesCalculateur): EntreesCalculateur {
  return {
    ...inputs,
    photo: inputs.photo ? '__blob__' : '',
    attachments: (inputs.attachments ?? []).map((a) => ({
      ...a,
      data: '__blob__',
    })),
  };
}

export function chargerSimulations(): SimulationSauvegardee[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(simulations: SimulationSauvegardee[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(simulations));
}

/**
 * Persist a simulation. If `inputs.id` is set, the matching simulation is overwritten
 * (even if it doesn't exist yet — the id is kept). Otherwise a new UUID is generated.
 * When overwriting, the previous state is pushed to history (capped at HISTORY_CAP).
 * Returns the saved simulation with its assigned id.
 */
export async function sauvegarderSimulation(nom: string, inputs: EntreesCalculateur): Promise<SimulationSauvegardee> {
  const sims = chargerSimulations();
  const id = inputs.id || crypto.randomUUID();

  // Store blobs in IndexedDB
  if (inputs.photo) {
    await putBlob(photoKey(id), inputs.photo);
  }
  for (const att of inputs.attachments ?? []) {
    if (att.data && att.data !== '__blob__') {
      await putBlob(attachKey(id, att.id), att.data);
    }
  }

  const existingIdx = sims.findIndex((s) => s.id === id);
  const existing = existingIdx >= 0 ? sims[existingIdx] : null;

  // Build history: if overwriting, push the previous state (unless too recent)
  let history: SnapshotSimulation[] = existing?.history ?? [];
  if (existing) {
    const prevSavedAt = new Date(existing.savedAt).getTime();
    const now = Date.now();
    const elapsedSec = (now - prevSavedAt) / 1000;
    if (elapsedSec >= HISTORY_MIN_INTERVAL_SEC) {
      history = [
        { inputs: existing.inputs, savedAt: existing.savedAt },
        ...history,
      ].slice(0, HISTORY_CAP);
    }
  }

  const sim: SimulationSauvegardee = {
    id,
    nom: nom || `Simulation ${sims.length + 1}`,
    inputs: { ...stripForStorage(inputs), id },
    savedAt: new Date().toISOString(),
    history,
  };

  if (existingIdx >= 0) {
    sims[existingIdx] = sim;
  } else {
    sims.push(sim);
  }
  saveAll(sims);
  return sim;
}

/**
 * Restore a snapshot from a simulation's history as a new current version.
 * The previous current state is NOT automatically pushed to history — callers
 * typically save afterward which will push the current (restored) state.
 * Returns the hydrated inputs of the restored snapshot (blobs restored from IndexedDB).
 */
export async function restaurerSnapshot(simId: string, snapshotIndex: number): Promise<EntreesCalculateur | null> {
  const sims = chargerSimulations();
  const sim = sims.find((s) => s.id === simId);
  if (!sim || !sim.history || snapshotIndex < 0 || snapshotIndex >= sim.history.length) {
    return null;
  }
  const snapshot = sim.history[snapshotIndex];
  // Hydrate blobs using the sim id (blobs are shared across snapshots).
  const inputs = { ...snapshot.inputs, id: sim.id };
  if (inputs.photo === '__blob__') {
    inputs.photo = (await getBlob(photoKey(sim.id))) ?? '';
  }
  if (inputs.attachments) {
    inputs.attachments = await Promise.all(
      inputs.attachments.map(async (a: PieceJointe) => {
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

/** Restore blobs from IndexedDB into a simulation's inputs */
export async function hydraterSimulation(sim: SimulationSauvegardee): Promise<EntreesCalculateur> {
  const inputs = { ...sim.inputs, id: sim.id };

  // Restore photo
  if (inputs.photo === '__blob__') {
    inputs.photo = (await getBlob(photoKey(sim.id))) ?? '';
  }

  // Restore attachments
  if (inputs.attachments) {
    inputs.attachments = await Promise.all(
      inputs.attachments.map(async (a: PieceJointe) => {
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

export async function supprimerSimulation(id: string): Promise<void> {
  const sims = chargerSimulations().filter((s) => s.id !== id);
  saveAll(sims);
  // Clean up blobs
  await deleteBlobsWithPrefix(`sim:${id}:`);
}

export async function exporterSimulations(): Promise<string> {
  const sims = chargerSimulations();
  // Hydrate all blobs back into the export data
  const hydrated = await Promise.all(
    sims.map(async (sim) => {
      const inputs = await hydraterSimulation(sim);
      return { ...sim, inputs };
    })
  );
  return JSON.stringify(hydrated, null, 2);
}

export async function importerSimulations(json: string): Promise<SimulationSauvegardee[]> {
  const imported = JSON.parse(json);
  if (!Array.isArray(imported)) throw new Error('Format invalide');
  const existing = chargerSimulations();
  const existingIds = new Set(existing.map((s) => s.id));
  const newSims = imported.filter((s: SimulationSauvegardee) => !existingIds.has(s.id));

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
