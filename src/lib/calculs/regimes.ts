import type { EntreesCalculateur, RegimeFiscalDetaille, ProjectionAnnuelle } from '@/types';
import { calculerTRI } from './irr';
import {
  PRELEVEMENTS_SOCIAUX,
  PRELEVEMENTS_SOCIAUX_LMNP,
  IS_TAUX_REDUIT,
  IS_SEUIL_REDUIT,
  IS_TAUX_NORMAL,
  SEUIL_MICRO_FONCIER,
  SEUIL_MICRO_BIC,
  ABATTEMENT_MICRO_FONCIER,
  ABATTEMENT_MICRO_BIC,
  IR_DEFICIT_GLOBAL_MAX,
  REPORT_DEFICIT_DUREE_ANNEES,
} from '../constants';
import { calculerAmortissementAnnee } from './impotIs';
import { round2 } from '@/lib/round';

/* ── State tracked across years ── */

export interface RegimeState {
  /** Deficit reportable aggregate (negative or 0 for backward-compatible reads) */
  deficitFiscal: number;
  /** Amortissement LMNP non utilise, reportable sans limite (positive or 0) */
  reportAmortLmnp: number;
  /** Time-limited deficits carried forward (IR reel / LMNP reel). Positive amounts. */
  deficitCarryforwards: Array<{ amount: number; yearsRemaining: number }>;
}

export function initialRegimeState(): RegimeState {
  return { deficitFiscal: 0, reportAmortLmnp: 0, deficitCarryforwards: [] };
}

/* ── Per-year inputs ── */

export interface YearTaxInput {
  annee: number;
  loyerBrut: number;      // annual, before vacancy
  loyerNet: number;       // annual, after vacancy
  charges: number;        // annual deductible charges (copro, TF, PNO, gestion, etc.)
  interets: number;       // annual pret interest
  assurancePret: number;  // annual pret insurance
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
  regime: RegimeFiscalDetaille,
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

function tauxIRLocationNue(tmi: number): number {
  return tmi + PRELEVEMENTS_SOCIAUX;
}

function tauxIRLmnp(tmi: number): number {
  return tmi + PRELEVEMENTS_SOCIAUX_LMNP;
}

function sumBuckets(buckets: RegimeState['deficitCarryforwards']): number {
  return round2(buckets.reduce((sum, bucket) => sum + bucket.amount, 0));
}

function ageBuckets(buckets: RegimeState['deficitCarryforwards']): RegimeState['deficitCarryforwards'] {
  return buckets
    .map((bucket) => ({ ...bucket, yearsRemaining: bucket.yearsRemaining - 1 }))
    .filter((bucket) => bucket.amount > 0 && bucket.yearsRemaining > 0);
}

function consumeBuckets(
  buckets: RegimeState['deficitCarryforwards'],
  taxableBase: number,
): { taxableBaseAfterUse: number; remainingBuckets: RegimeState['deficitCarryforwards']; used: number } {
  let remainingBase = round2(Math.max(0, taxableBase));
  let used = 0;
  const remainingBuckets = buckets.map((bucket) => {
    if (remainingBase <= 0 || bucket.amount <= 0) return bucket;
    const consumed = Math.min(bucket.amount, remainingBase);
    remainingBase = round2(remainingBase - consumed);
    used = round2(used + consumed);
    return { ...bucket, amount: round2(bucket.amount - consumed) };
  }).filter((bucket) => bucket.amount > 0);

  return {
    taxableBaseAfterUse: remainingBase,
    remainingBuckets,
    used,
  };
}

function buildStateFromBuckets(
  buckets: RegimeState['deficitCarryforwards'],
  reportAmortLmnp = 0,
): RegimeState {
  const totalCarryforward = sumBuckets(buckets);
  return {
    deficitFiscal: totalCarryforward === 0 ? 0 : round2(-totalCarryforward),
    reportAmortLmnp,
    deficitCarryforwards: buckets,
  };
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
  regime: RegimeFiscalDetaille,
  inputs: EntreesCalculateur,
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
      const base = round2(loyerBrut * (1 - ABATTEMENT_MICRO_FONCIER));
      const impot = round2(Math.max(0, base) * tauxIRLocationNue(tmi));
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
      const revenuFoncier = round2(loyerNet - charges - interets - assurancePret);
      const carryforwardIn = prevState.deficitCarryforwards ?? [];

      if (revenuFoncier < 0) {
        // Revenus imputes prioritairement sur les interets. Seule la fraction
        // hors interets est imputable au revenu global, plafonnee a 10 700 €.
        const revenuApresInterets = round2(loyerNet - interets);
        const revenuDisponiblePourCharges = Math.max(0, revenuApresInterets);
        const deficitInterets = round2(Math.max(0, -revenuApresInterets));
        const deficitHorsInterets = round2(Math.max(0, charges + assurancePret - revenuDisponiblePourCharges));
        const imputableGlobal = round2(Math.min(IR_DEFICIT_GLOBAL_MAX, deficitHorsInterets));
        const reportableFoncier = round2(deficitInterets + Math.max(0, deficitHorsInterets - imputableGlobal));
        const agedBuckets = ageBuckets(carryforwardIn);
        const nextBuckets = reportableFoncier > 0
          ? [...agedBuckets, { amount: reportableFoncier, yearsRemaining: REPORT_DEFICIT_DUREE_ANNEES }]
          : agedBuckets;

        return {
          impot: 0,
          resultatFiscal: revenuFoncier,
          amortissement: 0,
          state: buildStateFromBuckets(nextBuckets),
        };
      }

      const consumed = consumeBuckets(carryforwardIn, revenuFoncier);
      const nextBuckets = ageBuckets(consumed.remainingBuckets);
      const resultatApresReport = round2(consumed.taxableBaseAfterUse);
      return {
        impot: round2(resultatApresReport * tauxIRLocationNue(tmi)),
        resultatFiscal: resultatApresReport,
        amortissement: 0,
        state: buildStateFromBuckets(nextBuckets),
      };
    }

    /* ── LMNP - Micro-BIC ── */
    case 'lmnp_micro': {
      const base = round2(loyerBrut * (1 - ABATTEMENT_MICRO_BIC));
      const impot = round2(Math.max(0, base) * tauxIRLmnp(tmi));
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
      const resultatAvantAmort = round2(loyerNet - charges - interets - assurancePret);

      // 2. Amortissement utilisable = plafonne au resultat positif
      const amortDispo = round2(amortTheoriqueAnnee + prevState.reportAmortLmnp);
      const amortUtilise = resultatAvantAmort > 0
        ? round2(Math.min(amortDispo, resultatAvantAmort))
        : 0;
      const reportAmortNew = round2(amortDispo - amortUtilise);

      // 3. Resultat apres amort
      let resultatFiscal = round2(resultatAvantAmort - amortUtilise);

      const carryforwardIn = prevState.deficitCarryforwards ?? [];

      if (resultatFiscal < 0) {
        const agedBuckets = ageBuckets(carryforwardIn);
        const nextBuckets = [...agedBuckets, { amount: Math.abs(resultatFiscal), yearsRemaining: REPORT_DEFICIT_DUREE_ANNEES }];
        return {
          impot: 0,
          resultatFiscal,
          amortissement: amortUtilise,
          state: buildStateFromBuckets(nextBuckets, reportAmortNew),
        };
      }

      const consumed = consumeBuckets(carryforwardIn, resultatFiscal);
      const nextBuckets = ageBuckets(consumed.remainingBuckets);
      resultatFiscal = round2(consumed.taxableBaseAfterUse);
      return {
        impot: round2(resultatFiscal * tauxIRLmnp(tmi)),
        resultatFiscal,
        amortissement: amortUtilise,
        state: buildStateFromBuckets(nextBuckets, reportAmortNew),
      };
    }

    /* ── IS ── */
    case 'is': {
      const amortAnnee = calculerAmortissementAnnee(inputs, fraisNotaire, year.annee);
      const resultatAvantReport = round2(loyerNet - charges - amortAnnee - interets - assurancePret);
      const resultatFiscal = round2(resultatAvantReport + prevState.deficitFiscal);

      if (resultatFiscal < 0) {
        return {
          impot: 0,
          resultatFiscal,
          amortissement: amortAnnee,
          state: { ...initialRegimeState(), deficitFiscal: resultatFiscal },
        };
      }
      return {
        impot: round2(impotIS(resultatFiscal)),
        resultatFiscal,
        amortissement: amortAnnee,
        state: initialRegimeState(),
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
  regime: RegimeFiscalDetaille,
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

  const baseIR = round2(baseImposable * (1 - abattementIR));
  const basePS = round2(baseImposable * (1 - abattementPS));
  const impotPV = round2(baseIR * 0.19 + basePS * PRELEVEMENTS_SOCIAUX);

  const plusValueBrute = Math.max(0, prixVente - coutRevient);
  return { plusValueBrute, impotPV, plusValueNette: round2(prixVente - impotPV) };
}

/* ── Full projection under one regime ── */

export interface RegimeProjection {
  regime: RegimeFiscalDetaille;
  applicability: RegimeApplicability;
  projection: ProjectionAnnuelle[];
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
  regime: RegimeFiscalDetaille;
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
  regime: RegimeFiscalDetaille,
  inputs: EntreesCalculateur,
  fraisNotaire: number,
  years: YearComputed[],
): RegimeProjection {
  const applicability = regimeApplicability(regime, years[0]?.loyerBrut ?? 0);
  const projection: ProjectionAnnuelle[] = [];
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
    amortCumule = round2(amortCumule + taxOut.amortissement);
    impotCumule = round2(impotCumule + taxOut.impot);

    const cfAvantImpot = round2(y.loyerNet - y.mensualitesAnnee - y.charges);
    const cfApresImpot = round2(cfAvantImpot - taxOut.impot);
    cashFlowCumule = round2(cashFlowCumule + cfApresImpot);

    projection.push({
      annee: i + 1,
      loyerBrut: y.loyerBrut,
      loyerNet: y.loyerNet,
      charges: y.charges,
      interets: y.interets,
      capitalRembourse: y.capitalRembourse,
      assurancePret: y.assurancePret,
      amortissement: taxOut.amortissement,
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

const ALL_REGIMES: RegimeFiscalDetaille[] = ['ir_reel', 'ir_micro', 'lmnp_reel', 'lmnp_micro', 'is'];

function notesForRegime(
  regime: RegimeFiscalDetaille,
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
  inputs: EntreesCalculateur,
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
      regime === 'is' || regime === 'lmnp_reel' ? regProj.amortCumule : 0,
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
