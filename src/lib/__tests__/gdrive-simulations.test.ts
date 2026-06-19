import { describe, it, expect } from 'vitest';
import { extractSimulationDocs } from '@/lib/gdrive';
import type { SimulationSauvegardee, EntreesCalculateur, PieceJointe } from '@/types';

function makeSim(
  id: string,
  nom: string,
  photo: string,
  attachments: PieceJointe[] = [],
): SimulationSauvegardee {
  return {
    id,
    nom,
    inputs: { id, photo, attachments } as unknown as EntreesCalculateur,
    savedAt: '2026-01-01T00:00:00.000Z',
    history: [],
  };
}

describe('extractSimulationDocs (Google Drive sim blob extraction)', () => {
  it('extracts photo + attachments into the Simulations folder', () => {
    const att: PieceJointe = {
      id: 'att-12345678',
      nom: 'devis.pdf',
      type: 'application/pdf',
      taille: 10,
      data: 'data:application/pdf;base64,QUJD',
      ajouteLe: '2026-01-01',
    };
    const sims = [makeSim('sim-aaaaaaaa', 'Mon bien', 'data:image/png;base64,AAAA', [att])];

    const docs = extractSimulationDocs(sims, 'Haussmann');

    expect(docs).toHaveLength(2);
    expect(docs.every((d) => d.folderPath === 'Haussmann/Documents/Simulations')).toBe(true);
    // Photo filename derives its extension from the MIME type.
    expect(docs[0].fileName).toBe('Mon_bien_sim-aaaa_photo.png');
    expect(docs[0].dataUri).toBe('data:image/png;base64,AAAA');
    expect(docs[1].fileName).toBe('Mon_bien_att-1234_devis.pdf');
  });

  it('skips simulations without blobs and non-data-uri placeholders', () => {
    const sims = [
      makeSim('sim-1', 'Vide', ''),
      makeSim('sim-2', 'Stripped', '__blob__'),
    ];
    expect(extractSimulationDocs(sims, 'Haussmann')).toHaveLength(0);
  });

  it('produces unique filenames for two simulations sharing the same name', () => {
    const sims = [
      makeSim('aaaaaaaa-1111', 'Doublon', 'data:image/jpeg;base64,AAAA'),
      makeSim('bbbbbbbb-2222', 'Doublon', 'data:image/jpeg;base64,BBBB'),
    ];
    const names = extractSimulationDocs(sims, 'Haussmann').map((d) => d.fileName);
    expect(new Set(names).size).toBe(2);
  });
});
