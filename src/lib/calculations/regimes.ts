import type { CalculatorInputs, RegimeFiscalType, YearProjection } from '@/types';
import { calculerTRI } from './irr';
import {
  PRELEVEMENTS_SOCIAUX,
  IS_TAUX_REDUIT,
  IS_SEUIL_REDUIT,
  IS_TAUX_NORMAL,
  SEUIL_MICRO_FONCIER,
  SEUIL_MICRO_BIC,
  ABATTEMENT_MICRO_FONCIER,
  ABATTEMENT_MICRO_BIC,
} from '../constants';
import { calculerAmortissementAnnee } from './tax-is';

/* ── State tracked across years ── */

export interface RegimeState {
  /** Deficit reportable (negative or 0) — for IR reel, LMNP reel charges, IS */
  deficitFiscal: number;
  /** Amortissement LMNP non utilise, reportable sans limite (positive or 0) */
  reportAmortLmnp: number;
}

export function initialRegimeState(): RegimeState {
  return { deficitFiscal: 0, reportAmortLmnp: 0 };
}

/* ── Per-year inputs ── */

export interface YearTaxInput {
  annee: number;
  loyerBrut: number;      // annual, before vacancy
  loyerNet: number;       // annual, after vacancy
  charges: number;        // annual deductible charges (copro, TF, PNO, gestion, etc.)
  interets: number;       // annual loan interest
  assurancePret: number;  // annual loan insurance
}

export interface YearTaxOutput {
  impot: number;
  resultatFiscal: number;
  amortissement: number;
  state: RegimeState;
}

/* ── Applicability ── */

export interface RegimeApplicability {
  applicable: boolean;
  reason?: string;
}

/**
 * Check if a regime is applicable given the inputs.
 * Micro regimes have revenue thresholds.
 */
export function regimeApplicability(
  regime: RegimeFiscalType,
  loyerBrutAnnuel: number,
): RegimeApplicability {
  if (regime === 'ir_micro') {
    if (loyerBrutAnnuel > SEUIL_MICRO_FONCIER) {
      return {
        applicable: false,
        reason: `Revenus ${Math.round(loyerBrutAnnuel).toLocaleString('fr-FR')} € > plafond ${SEUIL_MICRO_FONCIER.toLocaleString('fr-FR')} €`,
      };
    }
  }
  if (regime === 'lmnp_micro') {
    if (loyerBrutAnnuel > SEUIL_MICRO_BIC) {
      return {
        applicable: false,
        reason: `Revenus ${Math.round(loyerBrutAnnuel).toLocaleString('fr-FR')} € > plafond ${SEUIL_MICRO_BIC.toLocaleString('fr-FR')} €`,
      };
    }
  }
  return { applicable: true };
}

/* ── Per-year tax computation ── */

function tauxIR(tmi: number): number {
  return tmi + PRELEVEMENTS_SOCIAUX;
}

function impotIS(resultatFiscal: number): number {
  if (resultatFiscal <= 0) return 0;
  if (resultatFiscal <= IS_SEUIL_REDUIT) {
    return resultatFiscal * IS_TAUX_REDUIT;
  }
  return IS_SEUIL_REDUIT * IS_TAUX_REDUIT + (resultatFiscal - IS_SEUIL_REDUIT) * IS_TAUX_NORMAL;
}

/**
 * Compute tax for a single year under a given regime.
 * Pure function — pass previous state, receive new state.
 */
export function computeTaxForRegime(
  regime: RegimeFiscalType,
  inputs: CalculatorInputs,
  fraisNotaire: number,
  year: YearTaxInput,
  prevState: RegimeState,
): YearTaxOutput {
  const tmi = inputs.trancheMarginalePct ?? 0.30;
  const { loyerBrut, loyerNet, charges, interets, assurancePret } = year;

  switch (regime) {
    /* ── IR - Micro-foncier ── */
    case 'ir_micro': {
      // Abattement forfaitaire 30%, pas de charges deductibles
      const base = loyerBrut * (1 - ABATTEMENT_MICRO_FONCIER);
      const impot = Math.max(0, base) * tauxIR(tmi);
      return {
        impot,
        resultatFiscal: base,
        amortissement: 0,
        state: initialRegimeState(), // no carryforward
      };
    }

    /* ── IR - Foncier reel ── */
    case 'ir_reel': {
      // Revenu foncier = loyers nets - charges - interets - assurance pret
      const revenuFoncier = loyerNet - charges - interets - assurancePret;
      // Apply deficit carryforward from prior years
      const resultatApresReport = revenuFoncier + prevState.deficitFiscal;

      if (resultatApresReport < 0) {
        return {
          impot: 0,
          resultatFiscal: resultatApresReport,
          amortissement: 0,
          state: { deficitFiscal: resultatApresReport, reportAmortLmnp: 0 },
        };
      }
      return {
        impot: resultatApresReport * tauxIR(tmi),
        resultatFiscal: resultatApresReport,
        amortissement: 0,
        state: { deficitFiscal: 0, reportAmortLmnp: 0 },
      };
    }

    /* ── LMNP - Micro-BIC ── */
    case 'lmnp_micro': {
      const base = loyerBrut * (1 - ABATTEMENT_MICRO_BIC);
      const impot = Math.max(0, base) * tauxIR(tmi);
      return {
        impot,
        resultatFiscal: base,
        amortissement: 0,
        state: initialRegimeState(),
      };
    }

    /* ── LMNP - Reel BIC ── */
    case 'lmnp_reel': {
      // LMNP: amortissement ne peut pas creer de deficit (art. 39C CGI)
      // Excedent d'amortissement reportable sans limite de duree.
      // Deficit BIC (hors amort) reportable 10 ans sur BIC uniquement.
      const amortTheoriqueAnnee = calculerAmortissementAnnee(inputs, fraisNotaire, year.annee);

      // 1. Resultat avant amortissement
      const resultatAvantAmort = loyerNet - charges - interets - assurancePret;

      // 2. Amortissement utilisable = plafonne au resultat positif
      const amortDispo = amortTheoriqueAnnee + prevState.reportAmortLmnp;
      const amortUtilise = resultatAvantAmort > 0
        ? Math.min(amortDispo, resultatAvantAmort)
        : 0;
      const reportAmortNew = amortDispo - amortUtilise;

      // 3. Resultat apres amort
      let resultatFiscal = resultatAvantAmort - amortUtilise;

      // 4. Apply deficit BIC carryforward
      resultatFiscal += prevState.deficitFiscal;

      if (resultatFiscal < 0) {
        return {
          impot: 0,
          resultatFiscal,
          amortissement: amortUtilise,
          state: { deficitFiscal: resultatFiscal, reportAmortLmnp: reportAmortNew },
        };
      }
      return {
        impot: resultatFiscal * tauxIR(tmi),
        resultatFiscal,
        amortissement: amortUtilise,
        state: { deficitFiscal: 0, reportAmortLmnp: reportAmortNew },
      };
    }

    /* ── IS ── */
    case 'is': {
      const amortAnnee = calculerAmortissementAnnee(inputs, fraisNotaire, year.annee);
      const resultatAvantReport = loyerNet - charges - amortAnnee - interets - assurancePret;
      const resultatFiscal = resultatAvantReport + prevState.deficitFiscal;

      if (resultatFiscal < 0) {
        return {
          impot: 0,
          resultatFiscal,
          amortissement: amortAnnee,
          state: { deficitFiscal: resultatFiscal, reportAmortLmnp: 0 },
        };
      }
      return {
        impot: impotIS(resultatFiscal),
        resultatFiscal,
        amortissement: amortAnnee,
        state: { deficitFiscal: 0, reportAmortLmnp: 0 },
      };
    }
  }
}

/* ── Exit tax (plus-value a la revente) ── */

/**
 * Plus-value a la revente (approximation simplifiee).
 * - IR reel / IR micro : plus-value des particuliers avec abattements pour duree
 *     - IR : exoneration apres 22 ans
 *     - PS : exoneration apres 30 ans
 * - LMNP (reel & micro) : depuis la LF 2025 (applicable aux cessions >= 15/02/2025),
 *   les amortissements deduits sont reintegres dans le calcul de la PV.
 *   PV = prix vente - (prix achat + frais + travaux - amortissements deduits)
 *   Les abattements pour duree de detention continuent de s'appliquer.
 *   Exceptions (hors scope ici) : residences services etudiantes/seniors/EHPAD restent
 *   exemptes de la reintegration. Les amort travaux "deductibles en charges" sont
 *   egalement exclus de la reintegration.
 * - IS : plus-value pro = prix vente - VNC (prix - amort cumules), taxee au taux IS.
 */
export function plusValueSortie(
  regime: RegimeFiscalType,
  prixAchat: number,
  travaux: number,
  fraisNotaire: number,
  prixVente: number,
  amortCumule: number,
  dureeDetention: number,
): { plusValueBrute: number; impotPV: number; plusValueNette: number } {
  const coutRevient = prixAchat + fraisNotaire + travaux;

  if (regime === 'is') {
    // IS: PV = prix vente - VNC
    const vnc = coutRevient - amortCumule;
    const plusValueIS = Math.max(0, prixVente - vnc);
    const impotPV = impotIS(plusValueIS);
    const plusValueBrute = Math.max(0, prixVente - coutRevient);
    return { plusValueBrute, impotPV, plusValueNette: prixVente - impotPV };
  }

  // LMNP reel : reintegration des amortissements (LF 2025)
  // LMNP micro & IR : pas de reintegration (amortCumule = 0 en LMNP micro/IR)
  const baseImposable = regime === 'lmnp_reel'
    ? Math.max(0, prixVente - (coutRevient - amortCumule))
    : Math.max(0, prixVente - coutRevient);

  // Abattements IR sur duree de detention :
  // - 0-5 ans : 0%
  // - 6-21 ans : 6%/an
  // - 22e annee : 4%
  // → exoneration totale apres 22 ans
  let abattementIR = 0;
  if (dureeDetention > 5) {
    abattementIR = Math.min(100, (dureeDetention - 5) * 6 + (dureeDetention >= 22 ? 4 : 0)) / 100;
  }
  if (dureeDetention >= 22) abattementIR = 1;

  // Abattements PS sur duree de detention :
  // - 0-5 ans : 0%
  // - 6-21 ans : 1.65%/an
  // - 22e annee : 1.60%
  // - 23-30 ans : 9%/an
  // → exoneration totale apres 30 ans
  let abattementPS = 0;
  if (dureeDetention > 5 && dureeDetention < 22) {
    abattementPS = (dureeDetention - 5) * 0.0165;
  } else if (dureeDetention >= 22 && dureeDetention < 30) {
    abattementPS = 16 * 0.0165 + 0.016 + (dureeDetention - 22) * 0.09;
  } else if (dureeDetention >= 30) {
    abattementPS = 1;
  }
  abattementPS = Math.min(1, abattementPS);

  const baseIR = baseImposable * (1 - abattementIR);
  const basePS = baseImposable * (1 - abattementPS);
  const impotPV = baseIR * 0.19 + basePS * PRELEVEMENTS_SOCIAUX;

  const plusValueBrute = Math.max(0, prixVente - coutRevient);
  return { plusValueBrute, impotPV, plusValueNette: prixVente - impotPV };
}

/* ── Full projection under one regime ── */

export interface RegimeProjection {
  regime: RegimeFiscalType;
  applicability: RegimeApplicability;
  projection: YearProjection[];
  amortCumule: number;
  impotCumule: number;
  cashFlowCumuleApresImpot: number;
  impotAn1: number;
  cashFlowAn1ApresImpot: number;
}

export interface YearComputed {
  loyerBrut: number;
  loyerNet: number;
  charges: number;
  interets: number;
  assurancePret: number;
  mensualitesAnnee: number;
  capitalRembourse: number;
  crd: number;
  valeurBien: number;
  plusValue: number;
}

export interface RegimeComparison {
  regime: RegimeFiscalType;
  applicability: RegimeApplicability;
  impotAn1: number;
  impotCumuleHorizon: number;
  cashFlowAn1ApresImpot: number;
  cashFlowCumuleHorizonApresImpot: number;
  triInvestisseur: number;
  amortCumule: number;
  patrimoineNetApresVente: number;
  notes: string[];
}

/**
 * Given pre-computed yearly financial data (independent of regime),
 * run tax computation for the given regime and return projection.
 */
export function projeterAvecRegime(
  regime: RegimeFiscalType,
  inputs: CalculatorInputs,
  fraisNotaire: number,
  years: YearComputed[],
): RegimeProjection {
  const applicability = regimeApplicability(regime, years[0]?.loyerBrut ?? 0);
  const projection: YearProjection[] = [];
  let state = initialRegimeState();
  let amortCumule = 0;
  let impotCumule = 0;
  let cashFlowCumule = 0;

  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    const taxOut = computeTaxForRegime(
      regime,
      inputs,
      fraisNotaire,
      {
        annee: i + 1,
        loyerBrut: y.loyerBrut,
        loyerNet: y.loyerNet,
        charges: y.charges,
        interets: y.interets,
        assurancePret: y.assurancePret,
      },
      state,
    );
    state = taxOut.state;
    amortCumule += taxOut.amortissement;
    impotCumule += taxOut.impot;

    const cfAvantImpot = y.loyerNet - y.mensualitesAnnee - y.charges;
    const cfApresImpot = cfAvantImpot - taxOut.impot;
    cashFlowCumule += cfApresImpot;

    projection.push({
      annee: i + 1,
      loyerBrut: y.loyerBrut,
      loyerNet: y.loyerNet,
      charges: y.charges,
      interets: y.interets,
      capitalRembourse: y.capitalRembourse,
      mensualitesCredit: y.mensualitesAnnee,
      cashFlowAvantImpot: cfAvantImpot,
      impot: taxOut.impot,
      cashFlowApresImpot: cfApresImpot,
      capitalRestantDu: y.crd,
      valeurBien: y.valeurBien,
      plusValue: y.plusValue,
    });
  }

  return {
    regime,
    applicability,
    projection,
    amortCumule,
    impotCumule,
    cashFlowCumuleApresImpot: cashFlowCumule,
    impotAn1: projection[0]?.impot ?? 0,
    cashFlowAn1ApresImpot: projection[0]?.cashFlowApresImpot ?? 0,
  };
}

/* ── Multi-regime comparison ── */

const ALL_REGIMES: RegimeFiscalType[] = ['ir_reel', 'ir_micro', 'lmnp_reel', 'lmnp_micro', 'is'];

function notesForRegime(
  regime: RegimeFiscalType,
  applicability: RegimeApplicability,
  regProj: RegimeProjection,
  horizon: number,
  amortCumule: number,
): string[] {
  const notes: string[] = [];

  if (!applicability.applicable && applicability.reason) {
    notes.push(applicability.reason);
  }

  switch (regime) {
    case 'ir_reel':
      notes.push('Deficit foncier imputable sur revenu global jusqu\'a 10 700 €/an (non simule ici).');
      notes.push('Prelevements sociaux 17.2% en plus de la TMI.');
      break;
    case 'ir_micro':
      notes.push('Abattement forfaitaire 30%, aucune charge deductible.');
      notes.push('Option valable pour 3 ans (option irrevocable).');
      break;
    case 'lmnp_reel':
      notes.push('Amortissements plafonnes au resultat positif (art. 39C CGI).');
      notes.push('Excedent d\'amortissement reportable sans limite.');
      notes.push('Deficit BIC reportable 10 ans sur BIC uniquement.');
      notes.push(`LF 2025 : amortissements reintegres a la PV de cession (cumul : ~${Math.round(amortCumule / 1000)} k€).`);
      break;
    case 'lmnp_micro':
      notes.push('Abattement forfaitaire 50%, aucune charge deductible.');
      notes.push('Regime ideal si peu de charges reelles.');
      break;
    case 'is':
      notes.push(`Plus-value a la revente calculee sur la VNC (amort cumules : ~${Math.round(amortCumule / 1000)} k€).`);
      notes.push('Impot sur les plus-values generalement plus lourd qu\'en IR.');
      notes.push('Deficit reportable sans limite de duree.');
      break;
  }

  if (regProj.impotAn1 === 0 && regProj.impotCumule === 0) {
    notes.push(`Impot nul sur ${horizon} ans (deficit/amortissements absorbent les revenus).`);
  }

  return notes;
}

export interface ComparerRegimesOptions {
  horizon: number;
  apportPersonnel: number;
}

export function comparerRegimes(
  inputs: CalculatorInputs,
  fraisNotaire: number,
  years: YearComputed[],
  opts: ComparerRegimesOptions,
): RegimeComparison[] {
  const horizon = Math.min(opts.horizon, years.length);

  return ALL_REGIMES.map((regime) => {
    const regProj = projeterAvecRegime(regime, inputs, fraisNotaire, years);
    const proj = regProj.projection;

    // Accumulate up to horizon
    let impotCumule = 0;
    let cashFlowCumule = 0;
    for (let i = 0; i < horizon; i++) {
      impotCumule += proj[i].impot;
      cashFlowCumule += proj[i].cashFlowApresImpot;
    }

    // TRI investisseur sur horizon
    const triCashFlows: number[] = [-opts.apportPersonnel];
    for (let i = 0; i < horizon; i++) {
      const p = proj[i];
      if (i < horizon - 1) {
        triCashFlows.push(p.cashFlowApresImpot);
      } else {
        // Sortie: CF + vente - CRD - impot plus-value
        const pv = plusValueSortie(
          regime,
          inputs.prixAchat,
          inputs.montantTravaux,
          fraisNotaire,
          p.valeurBien,
          regime === 'is' || regime === 'lmnp_reel' ? regProj.amortCumule : 0,
          horizon,
        );
        triCashFlows.push(p.cashFlowApresImpot + p.valeurBien - p.capitalRestantDu - pv.impotPV);
      }
    }
    const tri = calculerTRI(triCashFlows);

    // Patrimoine net apres vente
    const lastYear = proj[horizon - 1];
    const pvSortie = plusValueSortie(
      regime,
      inputs.prixAchat,
      inputs.montantTravaux,
      fraisNotaire,
      lastYear?.valeurBien ?? 0,
      regime === 'is' ? regProj.amortCumule : 0,
      horizon,
    );
    const patrimoineNet = (lastYear?.valeurBien ?? 0) - (lastYear?.capitalRestantDu ?? 0) - pvSortie.impotPV + cashFlowCumule;

    const notes = notesForRegime(regime, regProj.applicability, {
      ...regProj,
      impotCumule,
    }, horizon, regProj.amortCumule);

    return {
      regime,
      applicability: regProj.applicability,
      impotAn1: regProj.impotAn1,
      impotCumuleHorizon: impotCumule,
      cashFlowAn1ApresImpot: regProj.cashFlowAn1ApresImpot,
      cashFlowCumuleHorizonApresImpot: cashFlowCumule,
      triInvestisseur: tri,
      amortCumule: regProj.amortCumule,
      patrimoineNetApresVente: patrimoineNet,
      notes,
    };
  });
}
