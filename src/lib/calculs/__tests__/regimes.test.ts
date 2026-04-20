import { describe, it, expect } from 'vitest';
import {
  computeTaxForRegime,
  initialRegimeState,
  regimeApplicability,
  plusValueSortie,
  projeterAvecRegime,
  comparerRegimes,
  type YearTaxInput,
  type YearComputed,
} from '../regimes';
import type { EntreesCalculateur } from '@/types';
import { DEFAULT_CALCULATOR_INPUTS, PRELEVEMENTS_SOCIAUX, PRELEVEMENTS_SOCIAUX_LMNP } from '../../constants';
import { computeYearlyFinancials } from '../index';

/* ── Shared fixtures ── */

const baseInputs: EntreesCalculateur = {
  ...DEFAULT_CALCULATOR_INPUTS,
  prixAchat: 200_000,
  fraisNotairePct: 0.08,
  trancheMarginalePct: 0.30,
  montantTravaux: 0,
  lotsTravaux: [],
  lotsMobilier: [],
};

const fraisNotaire = 16_000; // 200k * 8%

function makeYear(overrides?: Partial<YearTaxInput>): YearTaxInput {
  return {
    annee: 1,
    loyerBrut: 9600,      // 800 * 12
    loyerNet: 9120,        // 9600 * (1 - 5% vacance)
    charges: 3000,
    interets: 6000,
    assurancePret: 700,
    ...overrides,
  };
}

/* ── regimeApplicability ── */

describe('regimeApplicability', () => {
  it('ir_micro applicable si < 15 000 €', () => {
    const r = regimeApplicability('ir_micro', 14_000);
    expect(r.applicable).toBe(true);
  });

  it('ir_micro non applicable si > 15 000 €', () => {
    const r = regimeApplicability('ir_micro', 16_000);
    expect(r.applicable).toBe(false);
    expect(r.reason).toContain('15');
  });

  it('lmnp_micro applicable si < 77 700 €', () => {
    expect(regimeApplicability('lmnp_micro', 50_000).applicable).toBe(true);
  });

  it('lmnp_micro non applicable si > 77 700 €', () => {
    expect(regimeApplicability('lmnp_micro', 80_000).applicable).toBe(false);
  });

  it('ir_reel, lmnp_reel, is toujours applicables', () => {
    expect(regimeApplicability('ir_reel', 100_000).applicable).toBe(true);
    expect(regimeApplicability('lmnp_reel', 100_000).applicable).toBe(true);
    expect(regimeApplicability('is', 100_000).applicable).toBe(true);
  });
});

/* ── computeTaxForRegime — IR Micro ── */

describe('computeTaxForRegime — ir_micro', () => {
  it('applique abattement 30% sur loyer brut', () => {
    const year = makeYear();
    const result = computeTaxForRegime('ir_micro', baseInputs, fraisNotaire, year, initialRegimeState());
    const base = 9600 * 0.70; // 6720
    const tauxTotal = 0.30 + PRELEVEMENTS_SOCIAUX;
    expect(result.resultatFiscal).toBeCloseTo(base, 0);
    expect(result.impot).toBeCloseTo(base * tauxTotal, 0);
    expect(result.amortissement).toBe(0);
  });

  it('pas de report de deficit', () => {
    const result = computeTaxForRegime('ir_micro', baseInputs, fraisNotaire, makeYear(), initialRegimeState());
    expect(result.state.deficitFiscal).toBe(0);
    expect(result.state.reportAmortLmnp).toBe(0);
  });
});

/* ── computeTaxForRegime — IR Reel ── */

describe('computeTaxForRegime — ir_reel', () => {
  it('resultat positif : loyer - charges - interets - assurance', () => {
    const year = makeYear({ loyerNet: 15_000, charges: 3000, interets: 4000, assurancePret: 500 });
    const result = computeTaxForRegime('ir_reel', baseInputs, fraisNotaire, year, initialRegimeState());
    const revenuFoncier = 15_000 - 3000 - 4000 - 500; // 7500
    expect(result.resultatFiscal).toBeCloseTo(revenuFoncier, 0);
    expect(result.impot).toBeGreaterThan(0);
  });

  it('deficit reporte quand resultat negatif', () => {
    const year = makeYear({ loyerNet: 2000, charges: 5000, interets: 4000, assurancePret: 500 });
    const result = computeTaxForRegime('ir_reel', baseInputs, fraisNotaire, year, initialRegimeState());
    // 2000 - 5000 - 4000 - 500 = -7500
    expect(result.resultatFiscal).toBeLessThan(0);
    expect(result.impot).toBe(0);
    expect(result.state.deficitFiscal).toBeLessThan(0);
  });

  it('deficit absorbe progressivement sur annees suivantes', () => {
    // Annee 1: gros deficit
    const y1 = makeYear({ loyerNet: 1000, charges: 5000, interets: 3000, assurancePret: 500 });
    const r1 = computeTaxForRegime('ir_reel', baseInputs, fraisNotaire, y1, initialRegimeState());
    expect(r1.state.deficitFiscal).toBeLessThan(0);

    // Annee 2: resultat positif absorbe le deficit
    const y2 = makeYear({ annee: 2, loyerNet: 12000, charges: 2000, interets: 2000, assurancePret: 500 });
    const r2 = computeTaxForRegime('ir_reel', baseInputs, fraisNotaire, y2, r1.state);
    // Seule la fraction reportable sur revenus fonciers est carry forward.
    // Le deficit imputable sur le revenu global n'est pas reporte dans le simulateur.
    expect(r2.resultatFiscal).toBeCloseTo(5_500, 0);
  });

  it('ne reporte pas la fraction imputable sur le revenu global', () => {
    // Exemple proche de la doctrine fiscale: 5k loyers, 12k charges hors interets, 6k interets.
    const y1 = makeYear({ loyerNet: 5000, charges: 12_000, interets: 6000, assurancePret: 0 });
    const r1 = computeTaxForRegime('ir_reel', baseInputs, fraisNotaire, y1, initialRegimeState());
    // Reportable = 2 300 € seulement (1 000 d'interets + 1 300 au-dela du plafond 10 700).
    expect(r1.state.deficitFiscal).toBeCloseTo(-2_300, 0);
  });
});

/* ── computeTaxForRegime — LMNP Micro ── */

describe('computeTaxForRegime — lmnp_micro', () => {
  it('applique abattement 50% sur loyer brut', () => {
    const year = makeYear();
    const result = computeTaxForRegime('lmnp_micro', baseInputs, fraisNotaire, year, initialRegimeState());
    const base = 9600 * 0.50;
    expect(result.resultatFiscal).toBeCloseTo(base, 0);
    expect(result.impot).toBeCloseTo(base * (0.30 + PRELEVEMENTS_SOCIAUX_LMNP), 0);
  });
});

/* ── computeTaxForRegime — LMNP Reel ── */

describe('computeTaxForRegime — lmnp_reel', () => {
  it('amortissement plafonne au resultat positif', () => {
    const inputs = { ...baseInputs, prixAchat: 200_000 };
    const year = makeYear({ annee: 1, loyerNet: 9120, charges: 3000, interets: 6000, assurancePret: 700 });
    const result = computeTaxForRegime('lmnp_reel', inputs, fraisNotaire, year, initialRegimeState());
    // resultatAvantAmort = 9120 - 3000 - 6000 - 700 = -580 → negatif, pas d'amort utilise
    expect(result.amortissement).toBe(0);
    expect(result.state.reportAmortLmnp).toBeGreaterThan(0);
  });

  it('amortissement utilise quand resultat positif', () => {
    const year = makeYear({ annee: 1, loyerNet: 15_000, charges: 2000, interets: 2000, assurancePret: 500 });
    const result = computeTaxForRegime('lmnp_reel', baseInputs, fraisNotaire, year, initialRegimeState());
    // resultatAvantAmort = 15000-2000-2000-500 = 10500
    // amort theorique annee 1 ~ 22400 (bien 6400 + notaire 16000)
    // utilise plafonne a 10500
    expect(result.amortissement).toBeCloseTo(10_500, 0);
    expect(result.resultatFiscal).toBeCloseTo(0, -1);
    expect(result.impot).toBeCloseTo(0, -1);
  });

  it('report amortissement cumulable sans limite', () => {
    const year = makeYear({ annee: 1, loyerNet: 2000, charges: 3000, interets: 1000, assurancePret: 500 });
    const r1 = computeTaxForRegime('lmnp_reel', baseInputs, fraisNotaire, year, initialRegimeState());
    // Deficit => pas d'amort utilise, report = amort theorique ~22400
    expect(r1.state.reportAmortLmnp).toBeGreaterThan(20_000);

    // Annee 2: encore un deficit
    const y2 = makeYear({ annee: 2, loyerNet: 2000, charges: 3000, interets: 1000, assurancePret: 500 });
    const r2 = computeTaxForRegime('lmnp_reel', baseInputs, fraisNotaire, y2, r1.state);
    // Report cumule = report annee 1 + amort annee 2 (~6400)
    expect(r2.state.reportAmortLmnp).toBeGreaterThan(r1.state.reportAmortLmnp);
  });

  it('fait expirer les deficits LMNP au bout de 10 ans', () => {
    const prevState = {
      ...initialRegimeState(),
      deficitFiscal: -1_500,
      deficitCarryforwards: [{ amount: 1_500, yearsRemaining: 1 }],
    };
    const year = makeYear({ annee: 11, loyerNet: 3500, charges: 3500, interets: 0, assurancePret: 0 });
    const result = computeTaxForRegime('lmnp_reel', baseInputs, fraisNotaire, year, prevState);
    expect(result.state.deficitFiscal).toBe(0);
    expect(result.state.deficitCarryforwards).toHaveLength(0);
  });
});

/* ── computeTaxForRegime — IS ── */

describe('computeTaxForRegime — is', () => {
  it('amortissement cree un deficit', () => {
    const year = makeYear({ annee: 1, loyerNet: 9120, charges: 3000, interets: 6000, assurancePret: 700 });
    const result = computeTaxForRegime('is', baseInputs, fraisNotaire, year, initialRegimeState());
    // resultat = 9120 - 3000 - amort(~22400) - 6000 - 700 = tres negatif
    expect(result.resultatFiscal).toBeLessThan(0);
    expect(result.impot).toBe(0);
    expect(result.amortissement).toBeGreaterThan(0);
  });

  it('deficit IS reportable sans limite', () => {
    const y1 = makeYear({ annee: 1 });
    const r1 = computeTaxForRegime('is', baseInputs, fraisNotaire, y1, initialRegimeState());
    expect(r1.state.deficitFiscal).toBeLessThan(0);

    // Annee 2: utilise le deficit
    const y2 = makeYear({ annee: 2, loyerNet: 15000, charges: 1000, interets: 2000, assurancePret: 500 });
    const r2 = computeTaxForRegime('is', baseInputs, fraisNotaire, y2, r1.state);
    // Le deficit annee 1 absorbe une partie du resultat annee 2
    expect(r2.resultatFiscal).toBeGreaterThan(r1.resultatFiscal);
  });

  it('IS applique taux progressif', () => {
    const year = makeYear({ annee: 3, loyerNet: 80_000, charges: 2000, interets: 1000, assurancePret: 500 });
    const result = computeTaxForRegime('is', baseInputs, fraisNotaire, year, initialRegimeState());
    if (result.resultatFiscal > 42_500) {
      // L'impot doit refléter les 2 tranches
      expect(result.impot).toBeGreaterThan(result.resultatFiscal * 0.15);
    }
  });
});

/* ── plusValueSortie ── */

describe('plusValueSortie', () => {
  it('IS : PV = prixVente - VNC (cout - amort cumules)', () => {
    const pv = plusValueSortie('is', 200_000, 30_000, 16_000, 300_000, 100_000, 10);
    // VNC = 246000 - 100000 = 146000
    // PV IS = 300000 - 146000 = 154000
    expect(pv.impotPV).toBeGreaterThan(0);
    expect(pv.plusValueBrute).toBeCloseTo(300_000 - 246_000, 0); // 54000
  });

  it('IR reel : abattements pour duree de detention', () => {
    // Exoneration totale apres 22 ans (IR)
    const pv22 = plusValueSortie('ir_reel', 200_000, 0, 16_000, 300_000, 0, 22);
    // Abattement IR = 100% apres 22 ans
    // Abattement PS != 100% (besoin de 30 ans)
    expect(pv22.impotPV).toBeGreaterThan(0); // PS restants
    expect(pv22.impotPV).toBeLessThan(15_000);

    // Exoneration totale apres 30 ans (IR + PS)
    const pv30 = plusValueSortie('ir_reel', 200_000, 0, 16_000, 300_000, 0, 30);
    expect(pv30.impotPV).toBeCloseTo(0, 0);
  });

  it('IR reel : pas d abattement avant 5 ans', () => {
    const pv3 = plusValueSortie('ir_reel', 200_000, 0, 16_000, 300_000, 0, 3);
    const pvBrute = 300_000 - (200_000 + 16_000);
    const impotSansAbattement = pvBrute * 0.19 + pvBrute * PRELEVEMENTS_SOCIAUX;
    expect(pv3.impotPV).toBeCloseTo(impotSansAbattement, 0);
  });

  it('LMNP reel : reintegration des amortissements (LF 2025)', () => {
    const pv = plusValueSortie('lmnp_reel', 200_000, 0, 16_000, 300_000, 50_000, 10);
    // Base imposable = max(0, 300000 - (216000 - 50000)) = max(0, 134000) = 134000
    // vs IR reel sans reintegration: max(0, 300000 - 216000) = 84000
    expect(pv.impotPV).toBeGreaterThan(0);

    const pvIR = plusValueSortie('ir_reel', 200_000, 0, 16_000, 300_000, 0, 10);
    // LMNP reel devrait payer plus d'impot a cause de la reintegration
    expect(pv.impotPV).toBeGreaterThan(pvIR.impotPV);
  });

  it('pas de PV si vente < cout de revient', () => {
    const pv = plusValueSortie('ir_reel', 200_000, 0, 16_000, 100_000, 0, 5);
    expect(pv.plusValueBrute).toBe(0);
  });
});

/* ── projeterAvecRegime ── */

describe('projeterAvecRegime', () => {
  // Build 5 years of YearComputed
  function makeYears(count: number): YearComputed[] {
    return Array.from({ length: count }, (_, i) => ({
      loyerBrut: 9600,
      loyerNet: 9120,
      charges: 3000,
      interets: 6000 - i * 500, // decroissant
      assurancePret: 700,
      mensualitesAnnee: 14_000,
      capitalRembourse: 8000 + i * 500,
      crd: 200_000 - (8000 + i * 500) * (i + 1),
      valeurBien: 230_000 * (1 + 0.02 * (i + 1)),
      plusValue: 230_000 * 0.02 * (i + 1),
    }));
  }

  it('projection 5 ans IR reel : cumuls coherents', () => {
    const years = makeYears(5);
    const proj = projeterAvecRegime('ir_reel', baseInputs, fraisNotaire, years);
    expect(proj.projection).toHaveLength(5);
    expect(proj.regime).toBe('ir_reel');

    // Cumul impot = somme des impots annuels
    const sumImpot = proj.projection.reduce((s, p) => s + p.impot, 0);
    expect(proj.impotCumule).toBeCloseTo(sumImpot, 1);

    // Cumul CF apres impot
    const sumCF = proj.projection.reduce((s, p) => s + p.cashFlowApresImpot, 0);
    expect(proj.cashFlowCumuleApresImpot).toBeCloseTo(sumCF, 1);
  });

  it('projection IS : amortissement cumule positif', () => {
    const years = makeYears(5);
    const proj = projeterAvecRegime('is', baseInputs, fraisNotaire, years);
    expect(proj.amortCumule).toBeGreaterThan(0);
  });

  it('chaque annee a CF avant et apres impot', () => {
    const years = makeYears(3);
    const proj = projeterAvecRegime('ir_reel', baseInputs, fraisNotaire, years);
    for (const p of proj.projection) {
      expect(typeof p.cashFlowAvantImpot).toBe('number');
      expect(typeof p.cashFlowApresImpot).toBe('number');
      expect(p.cashFlowApresImpot).toBeLessThanOrEqual(p.cashFlowAvantImpot);
    }
  });

  it('expose l amortissement annuel dans la projection', () => {
    const years = makeYears(2);
    const proj = projeterAvecRegime('is', baseInputs, fraisNotaire, years);
    expect(proj.projection[0].amortissement).toBeGreaterThan(0);
    expect(proj.projection[0].assurancePret).toBe(700);
  });
});

describe('comparerRegimes', () => {
  it('integre la reintegration LMNP reel dans le patrimoine net apres vente', () => {
    const inputs: EntreesCalculateur = {
      ...baseInputs,
      loyerMensuel: 1500,
      lots: [{ id: '1', nom: 'Lot 1', loyerMensuel: 1500 }],
      regimeFiscal: 'IR',
    };
    const fin = computeYearlyFinancials(inputs);
    const comparisons = comparerRegimes(inputs, fin.fraisNotaire, fin.years, {
      horizon: 10,
      apportPersonnel: fin.apportPersonnel,
    });
    const ir = comparisons.find((c) => c.regime === 'ir_reel');
    const lmnp = comparisons.find((c) => c.regime === 'lmnp_reel');
    expect(ir).toBeDefined();
    expect(lmnp).toBeDefined();
    expect(lmnp!.patrimoineNetApresVente).toBeLessThan(ir!.patrimoineNetApresVente);
  });
});
