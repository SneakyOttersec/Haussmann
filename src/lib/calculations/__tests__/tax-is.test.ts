import { describe, it, expect } from 'vitest';
import { calculerImpotIS, calculerAmortissementAnnee } from '../tax-is';
import { IS_TAUX_REDUIT, IS_SEUIL_REDUIT, IS_TAUX_NORMAL } from '../../constants';
import type { CalculatorInputs } from '@/types';
import { DEFAULT_CALCULATOR_INPUTS } from '../../constants';

describe('calculerImpotIS', () => {
  it('retourne 0 pour resultat negatif', () => {
    expect(calculerImpotIS(-10_000)).toBe(0);
  });

  it('retourne 0 pour resultat = 0', () => {
    expect(calculerImpotIS(0)).toBe(0);
  });

  it('tranche reduite : resultat <= 42 500', () => {
    const impot = calculerImpotIS(30_000);
    expect(impot).toBeCloseTo(30_000 * IS_TAUX_REDUIT, 2);
  });

  it('tranche reduite exacte : resultat = 42 500', () => {
    const impot = calculerImpotIS(IS_SEUIL_REDUIT);
    expect(impot).toBeCloseTo(IS_SEUIL_REDUIT * IS_TAUX_REDUIT, 2);
  });

  it('tranche mixte : resultat > 42 500', () => {
    const impot = calculerImpotIS(100_000);
    const expected = IS_SEUIL_REDUIT * IS_TAUX_REDUIT + (100_000 - IS_SEUIL_REDUIT) * IS_TAUX_NORMAL;
    expect(impot).toBeCloseTo(expected, 2);
  });
});

describe('calculerAmortissementAnnee', () => {
  const baseInputs: CalculatorInputs = {
    ...DEFAULT_CALCULATOR_INPUTS,
    prixAchat: 200_000,
    fraisAgence: 10_000,
    montantTravaux: 0,
    lotsTravaux: [],
    lotsMobilier: [{ id: '1', nom: 'Mobilier', montant: 7_000 }],
  };
  const fraisNotaire = 16_000; // 200k * 8%

  it('annee 1 : toutes composantes actives', () => {
    const amort = calculerAmortissementAnnee(baseInputs, fraisNotaire, 1);
    // Bien: 200000*0.8/25 = 6400
    // Notaire: 16000/1 = 16000
    // Agence: 10000/1 = 10000
    // Mobilier: 7000/7 = 1000
    expect(amort).toBeCloseTo(6400 + 16000 + 10000 + 1000, 0);
  });

  it('annee 2 : notaire et agence expires', () => {
    const amort = calculerAmortissementAnnee(baseInputs, fraisNotaire, 2);
    // Bien: 6400, Mobilier: 1000
    expect(amort).toBeCloseTo(6400 + 1000, 0);
  });

  it('annee 8 : mobilier expire (7 ans)', () => {
    const amort = calculerAmortissementAnnee(baseInputs, fraisNotaire, 8);
    // Bien seulement: 6400
    expect(amort).toBeCloseTo(6400, 0);
  });

  it('annee 26 : bien expire (25 ans)', () => {
    const amort = calculerAmortissementAnnee(baseInputs, fraisNotaire, 26);
    expect(amort).toBe(0);
  });

  it('avec lotsTravaux : durees specifiques', () => {
    const inputs: CalculatorInputs = {
      ...baseInputs,
      fraisAgence: 0,
      lotsMobilier: [],
      lotsTravaux: [
        { id: '1', nom: 'Toiture', montant: 50_000, dureeAmortissement: 25 },
        { id: '2', nom: 'Electrique', montant: 20_000, dureeAmortissement: 15 },
      ],
    };
    const amort1 = calculerAmortissementAnnee(inputs, fraisNotaire, 1);
    // Bien: 6400, Notaire: 16000, Toiture: 50000/25=2000, Elec: 20000/15=1333.33
    expect(amort1).toBeCloseTo(6400 + 16000 + 2000 + 1333.33, 0);

    // Annee 16 : electrique expire
    const amort16 = calculerAmortissementAnnee(inputs, fraisNotaire, 16);
    expect(amort16).toBeCloseTo(6400 + 2000, 0);
  });

  it('fallback montantTravaux si pas de lotsTravaux', () => {
    const inputs: CalculatorInputs = {
      ...baseInputs,
      fraisAgence: 0,
      lotsMobilier: [],
      lotsTravaux: [],
      montantTravaux: 36_000,
    };
    const amort = calculerAmortissementAnnee(inputs, fraisNotaire, 1);
    // Bien: 6400, Notaire: 16000, Travaux fallback: 36000/18 = 2000
    expect(amort).toBeCloseTo(6400 + 16000 + 2000, 0);

    // Annee 19 : travaux fallback expire (18 ans)
    const amort19 = calculerAmortissementAnnee(inputs, fraisNotaire, 19);
    expect(amort19).toBeCloseTo(6400, 0);
  });
});
