import { describe, it, expect } from 'vitest';
import { fractionAnneeDepuis } from '@/lib/utils';

describe('fractionAnneeDepuis', () => {
  it('returns 0 for years before the reference year', () => {
    expect(fractionAnneeDepuis(2024, '2025-07-15')).toBe(0);
  });

  it('returns 1 for years after the reference year', () => {
    expect(fractionAnneeDepuis(2026, '2025-07-15')).toBe(1);
  });

  it('pro-rates the reference year by the remaining months (month inclusive)', () => {
    // Reference en juillet (mois 7) -> Jul..Dec = 6 mois.
    expect(fractionAnneeDepuis(2025, '2025-07-15')).toBeCloseTo(6 / 12, 10);
    // Janvier -> annee pleine.
    expect(fractionAnneeDepuis(2025, '2025-01-01')).toBe(1);
    // Decembre -> 1 mois.
    expect(fractionAnneeDepuis(2025, '2025-12-31')).toBeCloseTo(1 / 12, 10);
  });

  it('returns 1 (no pro-rata) when no date or an invalid date is given', () => {
    expect(fractionAnneeDepuis(2025, undefined)).toBe(1);
    expect(fractionAnneeDepuis(2025, '')).toBe(1);
    expect(fractionAnneeDepuis(2025, 'pas-une-date')).toBe(1);
  });
});
