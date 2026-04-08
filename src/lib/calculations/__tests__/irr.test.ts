import { describe, it, expect } from 'vitest';
import { calculerTRI } from '../irr';

describe('calculerTRI', () => {
  it('cas classique investissement immobilier', () => {
    // Investissement -100k, 10 ans de CF +12k, revente +200k en annee 10
    const cashFlows = [-100_000];
    for (let i = 1; i <= 9; i++) cashFlows.push(12_000);
    cashFlows.push(12_000 + 200_000); // derniere annee: CF + revente
    const tri = calculerTRI(cashFlows);
    // Attendu: ~18-22% annuel
    expect(tri).toBeGreaterThan(15);
    expect(tri).toBeLessThan(25);
  });

  it('investissement mediocre : TRI faible', () => {
    // -200k, 10 ans de CF +5k, revente +180k
    const cashFlows = [-200_000];
    for (let i = 1; i <= 9; i++) cashFlows.push(5_000);
    cashFlows.push(5_000 + 180_000);
    const tri = calculerTRI(cashFlows);
    expect(tri).toBeGreaterThan(0);
    expect(tri).toBeLessThan(5);
  });

  it('retourne 0 si pas de changement de signe', () => {
    expect(calculerTRI([100, 200, 300])).toBe(0);
    expect(calculerTRI([-100, -200, -300])).toBe(0);
  });

  it('retourne 0 si moins de 2 flux', () => {
    expect(calculerTRI([-100_000])).toBe(0);
    expect(calculerTRI([])).toBe(0);
  });

  it('investissement tres rentable', () => {
    // -50k, 5 ans de CF +30k
    const cashFlows = [-50_000, 30_000, 30_000, 30_000, 30_000, 30_000];
    const tri = calculerTRI(cashFlows);
    expect(tri).toBeGreaterThan(40);
  });

  it('investissement a perte', () => {
    // -200k, 5 ans de CF +1k, revente +100k
    const cashFlows = [-200_000, 1_000, 1_000, 1_000, 1_000, 1_000 + 100_000];
    const tri = calculerTRI(cashFlows);
    expect(tri).toBeLessThan(0);
  });
});
