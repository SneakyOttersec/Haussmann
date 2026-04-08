import { describe, it, expect } from 'vitest';
import { rendementBrut, rendementNet, rendementNetNet } from '../rendement';

describe('rendementBrut', () => {
  it('calcule (loyer / cout) * 100', () => {
    expect(rendementBrut(9600, 200_000)).toBeCloseTo(4.8, 2);
  });

  it('retourne 0 si cout = 0', () => {
    expect(rendementBrut(9600, 0)).toBe(0);
  });

  it('retourne 0 si cout negatif', () => {
    expect(rendementBrut(9600, -100)).toBe(0);
  });
});

describe('rendementNet', () => {
  it('calcule (loyer - charges) / cout * 100', () => {
    // (9120 - 3000) / 200000 * 100 = 3.06
    expect(rendementNet(9120, 3000, 200_000)).toBeCloseTo(3.06, 2);
  });

  it('retourne 0 si cout = 0', () => {
    expect(rendementNet(9120, 3000, 0)).toBe(0);
  });

  it('peut etre negatif si charges > loyer', () => {
    expect(rendementNet(5000, 8000, 200_000)).toBeLessThan(0);
  });
});

describe('rendementNetNet', () => {
  it('calcule (loyer - charges - impot) / cout * 100', () => {
    // (9120 - 3000 - 2000) / 200000 * 100 = 2.06
    expect(rendementNetNet(9120, 3000, 2000, 200_000)).toBeCloseTo(2.06, 2);
  });

  it('retourne 0 si cout = 0', () => {
    expect(rendementNetNet(9120, 3000, 2000, 0)).toBe(0);
  });
});
