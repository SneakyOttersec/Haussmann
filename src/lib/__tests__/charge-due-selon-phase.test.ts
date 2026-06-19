import { describe, it, expect } from 'vitest';
import { chargeDueSelonPhase } from '@/lib/utils';

const avantActe = { postActe: false, enLocation: false };
const entreActeEtLocation = { postActe: true, enLocation: false };
const enLocation = { postActe: true, enLocation: true };

describe('chargeDueSelonPhase', () => {
  it('never counts the credit category (handled separately)', () => {
    expect(chargeDueSelonPhase('credit', enLocation)).toBe(false);
    expect(chargeDueSelonPhase('credit', entreActeEtLocation)).toBe(false);
  });

  it('counts gestion locative and entretien only once the bien is en exploitation/location', () => {
    for (const cat of ['gestion_locative', 'reparations'] as const) {
      expect(chargeDueSelonPhase(cat, avantActe)).toBe(false);
      expect(chargeDueSelonPhase(cat, entreActeEtLocation)).toBe(false);
      expect(chargeDueSelonPhase(cat, enLocation)).toBe(true);
    }
  });

  it('counts ownership charges (taxe fonciere / PNO / copro) from the acte', () => {
    for (const cat of ['taxe_fonciere', 'assurance_pno', 'copropriete'] as const) {
      expect(chargeDueSelonPhase(cat, avantActe)).toBe(false);
      expect(chargeDueSelonPhase(cat, entreActeEtLocation)).toBe(true);
      expect(chargeDueSelonPhase(cat, enLocation)).toBe(true);
    }
  });

  it('counts nothing before the acte', () => {
    for (const cat of ['taxe_fonciere', 'gestion_locative', 'assurance_pno', 'autre'] as const) {
      expect(chargeDueSelonPhase(cat, avantActe)).toBe(false);
    }
  });
});
