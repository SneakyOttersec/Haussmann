import { describe, it, expect } from 'vitest';
import { cashFlowMensuel, cashFlowAnnuel } from '../cashflow';

describe('cashFlowMensuel', () => {
  it('calcule loyer - credit - charges', () => {
    expect(cashFlowMensuel(800, 600, 100)).toBe(100);
  });

  it('peut etre negatif', () => {
    expect(cashFlowMensuel(500, 600, 100)).toBe(-200);
  });

  it('zero partout', () => {
    expect(cashFlowMensuel(0, 0, 0)).toBe(0);
  });
});

describe('cashFlowAnnuel', () => {
  it('calcule loyer annuel - mensualites annuelles - charges annuelles', () => {
    expect(cashFlowAnnuel(9600, 7200, 1200)).toBe(1200);
  });

  it('peut etre negatif', () => {
    expect(cashFlowAnnuel(6000, 7200, 1200)).toBe(-2400);
  });
});
