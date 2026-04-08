import { describe, it, expect } from 'vitest';
import {
  calculerMensualiteAmortissable,
  calculerMensualiteInFine,
  calculerMensualite,
  capitalRestantDu,
  interetsAnnuels,
} from '../loan';

describe('calculerMensualiteAmortissable', () => {
  it('calcule la mensualite standard (200k, 3.5%, 20 ans)', () => {
    const m = calculerMensualiteAmortissable(200_000, 0.035, 20);
    // Attendu ~1159.92 €/mois
    expect(m).toBeCloseTo(1159.92, 0);
  });

  it('retourne capital/nb_mois si taux = 0', () => {
    const m = calculerMensualiteAmortissable(120_000, 0, 10);
    expect(m).toBe(1000);
  });

  it('retourne 0 si capital <= 0', () => {
    expect(calculerMensualiteAmortissable(0, 0.03, 20)).toBe(0);
    expect(calculerMensualiteAmortissable(-100, 0.03, 20)).toBe(0);
  });

  it('retourne 0 si duree <= 0', () => {
    expect(calculerMensualiteAmortissable(100_000, 0.03, 0)).toBe(0);
  });

  it('calcule correctement pour duree courte (1 an)', () => {
    const m = calculerMensualiteAmortissable(12_000, 0.12, 1);
    // ~1066.19 €/mois
    expect(m).toBeGreaterThan(1000);
    expect(m).toBeLessThan(1100);
  });
});

describe('calculerMensualiteInFine', () => {
  it('retourne les interets mensuels seulement', () => {
    const m = calculerMensualiteInFine(200_000, 0.036);
    // 200000 * 0.036 / 12 = 600
    expect(m).toBeCloseTo(600, 2);
  });

  it('retourne 0 si capital <= 0', () => {
    expect(calculerMensualiteInFine(0, 0.03)).toBe(0);
  });
});

describe('calculerMensualite', () => {
  it('dispatche vers amortissable', () => {
    const m = calculerMensualite(200_000, 0.035, 20, 'amortissable');
    expect(m).toBeCloseTo(1159.92, 0);
  });

  it('dispatche vers in_fine', () => {
    const m = calculerMensualite(200_000, 0.036, 20, 'in_fine');
    expect(m).toBeCloseTo(600, 2);
  });
});

describe('capitalRestantDu', () => {
  it('retourne le capital initial en annee 0', () => {
    const crd = capitalRestantDu(200_000, 0.035, 20, 0, 'amortissable');
    expect(crd).toBeCloseTo(200_000, 0);
  });

  it('diminue progressivement', () => {
    const crd1 = capitalRestantDu(200_000, 0.035, 20, 1, 'amortissable');
    const crd10 = capitalRestantDu(200_000, 0.035, 20, 10, 'amortissable');
    const crd19 = capitalRestantDu(200_000, 0.035, 20, 19, 'amortissable');
    expect(crd1).toBeLessThan(200_000);
    expect(crd10).toBeLessThan(crd1);
    expect(crd19).toBeLessThan(crd10);
    expect(crd19).toBeGreaterThan(0);
  });

  it('atteint ~0 en fin de pret', () => {
    const crd = capitalRestantDu(200_000, 0.035, 20, 20, 'amortissable');
    expect(crd).toBeLessThan(1);
  });

  it('in_fine retourne le capital tant que pret pas fini', () => {
    expect(capitalRestantDu(200_000, 0.035, 20, 5, 'in_fine')).toBe(200_000);
    expect(capitalRestantDu(200_000, 0.035, 20, 19, 'in_fine')).toBe(200_000);
    expect(capitalRestantDu(200_000, 0.035, 20, 20, 'in_fine')).toBe(0);
  });

  it('taux 0 — lineaire', () => {
    const crd = capitalRestantDu(120_000, 0, 10, 5, 'amortissable');
    expect(crd).toBeCloseTo(60_000, 0);
  });
});

describe('interetsAnnuels', () => {
  it('sont decroissants en amortissable', () => {
    const i1 = interetsAnnuels(200_000, 0.035, 20, 1, 'amortissable');
    const i10 = interetsAnnuels(200_000, 0.035, 20, 10, 'amortissable');
    const i20 = interetsAnnuels(200_000, 0.035, 20, 20, 'amortissable');
    expect(i1).toBeGreaterThan(i10);
    expect(i10).toBeGreaterThan(i20);
    expect(i20).toBeGreaterThan(0);
  });

  it('annee 1 : interets proches de capital * taux', () => {
    const i1 = interetsAnnuels(200_000, 0.035, 20, 1, 'amortissable');
    // ~6800-7000 (slightly less than 200k * 3.5% = 7000 because capital decreases)
    expect(i1).toBeGreaterThan(6500);
    expect(i1).toBeLessThan(7100);
  });

  it('in_fine : interets constants', () => {
    const i1 = interetsAnnuels(200_000, 0.036, 20, 1, 'in_fine');
    const i10 = interetsAnnuels(200_000, 0.036, 20, 10, 'in_fine');
    expect(i1).toBeCloseTo(7200, 2); // 200000 * 0.036
    expect(i10).toBeCloseTo(7200, 2);
  });
});
