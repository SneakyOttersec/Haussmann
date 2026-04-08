import { describe, it, expect } from 'vitest';
import { computeSensitivity } from '../sensitivity';
import type { CalculatorInputs } from '@/types';
import { DEFAULT_CALCULATOR_INPUTS } from '../../constants';

describe('computeSensitivity', () => {
  const inputs: CalculatorInputs = { ...DEFAULT_CALCULATOR_INPUTS };

  it('retourne des resultats pour chaque parametre', () => {
    const results = computeSensitivity(inputs);
    expect(results.length).toBeGreaterThanOrEqual(6);
    for (const r of results) {
      expect(r.key).toBeTruthy();
      expect(r.label).toBeTruthy();
      expect(typeof r.triBase).toBe('number');
      expect(typeof r.triLow).toBe('number');
      expect(typeof r.triHigh).toBe('number');
    }
  });

  it('triBase identique pour tous les params', () => {
    const results = computeSensitivity(inputs);
    const base = results[0].triBase;
    for (const r of results) {
      expect(r.triBase).toBeCloseTo(base, 4);
    }
  });

  it('spread >= 0 pour chaque param', () => {
    const results = computeSensitivity(inputs);
    for (const r of results) {
      expect(r.spread).toBeGreaterThanOrEqual(0);
    }
    // Au moins certains params ont un impact non-nul
    const nonZero = results.filter(r => r.spread > 0);
    expect(nonZero.length).toBeGreaterThan(3);
  });

  it('deltaLow + deltaHigh = triLow + triHigh - 2*triBase', () => {
    const results = computeSensitivity(inputs);
    for (const r of results) {
      expect(r.deltaLow).toBeCloseTo(r.triLow - r.triBase, 4);
      expect(r.deltaHigh).toBeCloseTo(r.triHigh - r.triBase, 4);
    }
  });

  it('resultats tries par spread decroissant', () => {
    const results = computeSensitivity(inputs);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].spread).toBeGreaterThanOrEqual(results[i].spread);
    }
  });

  it('augmenter le loyer augmente le TRI', () => {
    const results = computeSensitivity(inputs);
    const loyer = results.find(r => r.key === 'loyer');
    expect(loyer).toBeDefined();
    expect(loyer!.deltaHigh).toBeGreaterThan(0);
    expect(loyer!.deltaLow).toBeLessThan(0);
  });

  it('variation du prix d achat a un impact sur le TRI', () => {
    const results = computeSensitivity(inputs);
    const prix = results.find(r => r.key === 'prixAchat');
    expect(prix).toBeDefined();
    // Prix + apport sont decorreles dans les defaults → le sens depend du scenario
    // On verifie juste que la variation a un impact
    expect(prix!.spread).toBeGreaterThan(0);
  });
});
