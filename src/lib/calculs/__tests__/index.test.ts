import { describe, it, expect } from 'vitest';
import { calculerRentabilite, calculerTAEGPourInputs, computeYearlyFinancials } from '../index';
import type { EntreesCalculateur } from '@/types';
import { DEFAULT_CALCULATOR_INPUTS } from '../../constants';

describe('computeYearlyFinancials', () => {
  const inputs: EntreesCalculateur = { ...DEFAULT_CALCULATOR_INPUTS };

  it('calcule le cout total d acquisition', () => {
    const fin = computeYearlyFinancials(inputs);
    const mobilier = (inputs.lotsMobilier ?? []).reduce((s, l) => s + l.montant, 0)
      || inputs.montantMobilierTotal
      || 0;
    const expectedCout = inputs.prixAchat + inputs.prixAchat * inputs.fraisNotairePct
      + inputs.fraisAgence + (inputs.fraisDossier ?? 0) + (inputs.fraisCourtage ?? 0)
      + (inputs.fraisGarantie ?? 0) + inputs.montantTravaux + mobilier;
    expect(fin.coutTotalAcquisition).toBeCloseTo(expectedCout, 0);
  });

  it('loyer annuel brut = lots * 12 + autres revenus', () => {
    const fin = computeYearlyFinancials(inputs);
    const totalLots = inputs.lots.reduce((s, l) => s + l.loyerMensuel, 0);
    expect(fin.loyerAnnuelBrut).toBeCloseTo(totalLots * 12 + inputs.autresRevenusAnnuels, 0);
  });

  it('loyer net = brut * (1 - vacance)', () => {
    const fin = computeYearlyFinancials(inputs);
    expect(fin.loyerAnnuelNet).toBeCloseTo(fin.loyerAnnuelBrut * (1 - inputs.tauxVacance), 0);
  });

  it('genere 25 annees de projection', () => {
    const fin = computeYearlyFinancials(inputs);
    expect(fin.years.length).toBeGreaterThanOrEqual(25);
  });

  it('CRD atteint ~0 en fin de pret (annee dureeCredit)', () => {
    const fin = computeYearlyFinancials(inputs);
    const lastLoanYear = fin.years[inputs.dureeCredit - 1];
    expect(lastLoanYear.crd).toBeLessThan(100); // ~0 avec tolerance
  });

  it('valeur bien augmente avec appreciation', () => {
    const fin = computeYearlyFinancials(inputs);
    for (let i = 1; i < fin.years.length; i++) {
      expect(fin.years[i].valeurBien).toBeGreaterThan(fin.years[i - 1].valeurBien);
    }
  });

  it('interets decroissants pour pret amortissable', () => {
    const fin = computeYearlyFinancials(inputs);
    // Verifier sur les annees du pret
    for (let i = 1; i < inputs.dureeCredit; i++) {
      expect(fin.years[i].interets).toBeLessThanOrEqual(fin.years[i - 1].interets + 1);
    }
  });

  it('avec differe pret : annee 1 paye uniquement interets', () => {
    const deferredInputs: EntreesCalculateur = { ...inputs, differePretMois: 12 };
    const fin = computeYearlyFinancials(deferredInputs);
    // En differe total, mensualites annee 1 = interets + assurance seulement
    // capital rembourse devrait etre ~0
    expect(fin.years[0].capitalRembourse).toBeLessThan(100);
  });

  it('arrete l assurance emprunteur apres la fin effective du pret', () => {
    const fin = computeYearlyFinancials(inputs);
    const afterLoan = fin.years[inputs.dureeCredit];
    expect(afterLoan.assurancePret).toBe(0);
    expect(afterLoan.mensualitesAnnee).toBe(0);
  });
});

describe('calculerRentabilite', () => {
  const inputs: EntreesCalculateur = { ...DEFAULT_CALCULATOR_INPUTS };

  it('retourne des rendements positifs pour les inputs par defaut', () => {
    const results = calculerRentabilite(inputs);
    expect(results.rendementBrut).toBeGreaterThan(0);
    expect(results.rendementNet).toBeGreaterThan(0);
    // Net-net peut etre negatif ou positif
    expect(typeof results.rendementNetNet).toBe('number');
  });

  it('rendement brut > net > net-net', () => {
    const results = calculerRentabilite(inputs);
    expect(results.rendementBrut).toBeGreaterThan(results.rendementNet);
    expect(results.rendementNet).toBeGreaterThanOrEqual(results.rendementNetNet);
  });

  it('rendement brut = loyer brut / cout total * 100', () => {
    const results = calculerRentabilite(inputs);
    const expected = (results.loyerAnnuelBrut / results.coutTotalAcquisition) * 100;
    expect(results.rendementBrut).toBeCloseTo(expected, 1);
  });

  it('cash flow mensuel = annuel / 12', () => {
    const results = calculerRentabilite(inputs);
    expect(results.cashFlowMensuelAvantImpot).toBeCloseTo(results.cashFlowAnnuelAvantImpot / 12, 1);
    expect(results.cashFlowMensuelApresImpot).toBeCloseTo(results.cashFlowAnnuelApresImpot / 12, 1);
  });

  it('TRI est un nombre raisonnable', () => {
    const results = calculerRentabilite(inputs);
    expect(results.tri).toBeGreaterThan(-20);
    expect(results.tri).toBeLessThan(50);
  });

  it('projection contient les bonnes annees', () => {
    const results = calculerRentabilite(inputs);
    expect(results.projection.length).toBeGreaterThanOrEqual(25);
    expect(results.projection[0].annee).toBe(1);
    expect(results.projection[24].annee).toBe(25);
  });

  it('regime IS change les resultats fiscaux sur l horizon', () => {
    const irResults = calculerRentabilite({ ...inputs, regimeFiscal: 'IR' });
    const isResults = calculerRentabilite({ ...inputs, regimeFiscal: 'IS' });
    // L'impot cumule sur 25 ans devrait differer entre IR et IS
    const irCumul = irResults.projection.reduce((s, p) => s + p.impot, 0);
    const isCumul = isResults.projection.reduce((s, p) => s + p.impot, 0);
    expect(irCumul).not.toBeCloseTo(isCumul, -2);
  });

  it('augmenter le loyer augmente le rendement', () => {
    const base = calculerRentabilite(inputs);
    const higher = calculerRentabilite({
      ...inputs,
      lots: [{ id: '1', nom: 'Lot 1', loyerMensuel: 1200 }],
      loyerMensuel: 1200,
    });
    expect(higher.rendementBrut).toBeGreaterThan(base.rendementBrut);
  });

  it('in_fine : pret avec remboursement final', () => {
    const results = calculerRentabilite({ ...inputs, typePret: 'in_fine' });
    expect(results.rendementBrut).toBeGreaterThan(0);
    // En in_fine, le CRD reste le capital jusqu'a la derniere annee
    // creditAnnee simule mois par mois — CRD annee 1 doit encore etre > 0
    expect(results.projection[0].capitalRestantDu).toBeGreaterThan(0);
    // Apres la duree du pret, CRD = 0
    const afterLoan = results.projection[inputs.dureeCredit];
    if (afterLoan) {
      expect(afterLoan.capitalRestantDu).toBe(0);
    }
  });
});

describe('calculerTAEGPourInputs', () => {
  it('est superieur au taux nominal quand assurance et frais obligatoires existent', () => {
    const taeg = calculerTAEGPourInputs(DEFAULT_CALCULATOR_INPUTS);
    expect(taeg).toBeGreaterThan(DEFAULT_CALCULATOR_INPUTS.tauxCredit * 100);
  });

  it('augmente quand on ajoute des frais obligatoires', () => {
    const sansFrais = calculerTAEGPourInputs({
      ...DEFAULT_CALCULATOR_INPUTS,
      fraisDossier: 0,
      fraisCourtage: 0,
      fraisGarantie: 0,
      assurancePretAnnuelle: 0,
    });
    const avecFrais = calculerTAEGPourInputs({
      ...DEFAULT_CALCULATOR_INPUTS,
      fraisDossier: 1200,
      fraisCourtage: 1800,
      fraisGarantie: 2500,
      assurancePretAnnuelle: 900,
    });
    expect(avecFrais).toBeGreaterThan(sansFrais);
  });

  it('reste calculable avec differe', () => {
    const taeg = calculerTAEGPourInputs({
      ...DEFAULT_CALCULATOR_INPUTS,
      differePretMois: 12,
      differePretInclus: false,
      fraisDossier: 900,
      fraisCourtage: 1500,
      fraisGarantie: 2000,
    });
    expect(taeg).toBeGreaterThan(0);
  });
});
