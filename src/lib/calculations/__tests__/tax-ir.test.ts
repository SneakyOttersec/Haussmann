import { describe, it, expect } from 'vitest';
import { calculerImpotIR } from '../tax-ir';
import { PRELEVEMENTS_SOCIAUX } from '../../constants';

describe('calculerImpotIR', () => {
  it('calcule impot = revenu * (TMI + PS) pour revenu positif', () => {
    const impot = calculerImpotIR(10_000, 0.30);
    // 10000 * (0.30 + 0.172) = 4720
    expect(impot).toBeCloseTo(4720, 2);
  });

  it('retourne 0 pour revenu negatif', () => {
    expect(calculerImpotIR(-5000, 0.30)).toBe(0);
  });

  it('retourne 0 pour revenu = 0', () => {
    expect(calculerImpotIR(0, 0.30)).toBe(0);
  });

  it('TMI 0% : seuls les prelevements sociaux', () => {
    const impot = calculerImpotIR(10_000, 0);
    expect(impot).toBeCloseTo(10_000 * PRELEVEMENTS_SOCIAUX, 2);
  });

  it('TMI 45% : tranche maximale', () => {
    const impot = calculerImpotIR(50_000, 0.45);
    expect(impot).toBeCloseTo(50_000 * (0.45 + PRELEVEMENTS_SOCIAUX), 2);
  });
});
