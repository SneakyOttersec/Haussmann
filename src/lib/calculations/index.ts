import type { CalculatorInputs, CalculatorResults, RegimeFiscalType } from '@/types';
import { toRegimeFiscalType } from '@/types';
import { calculerMensualite, calculerMensualiteAmortissable } from './loan';
import { rendementBrut, rendementNet, rendementNetNet } from './rendement';
import { calculerTRI } from './irr';
import { projeterAvecRegime, type YearComputed } from './regimes';

function resolveAssuranceAnnuelle(inputs: CalculatorInputs): number {
  if (inputs.assurancePretMode === 'pct') {
    return inputs.montantEmprunte * inputs.assurancePretPct;
  }
  return inputs.assurancePretAnnuelle;
}

function calculerTAEG(
  montantEmprunte: number,
  tauxCredit: number,
  dureeAnnees: number,
  assuranceAnnuelle: number,
): number {
  if (montantEmprunte <= 0 || dureeAnnees <= 0) return 0;
  const mensualiteCredit = calculerMensualite(montantEmprunte, tauxCredit, dureeAnnees, 'amortissable');
  const mensualiteTotale = mensualiteCredit + assuranceAnnuelle / 12;
  let r = tauxCredit / 12 || 0.003;
  const n = dureeAnnees * 12;
  for (let i = 0; i < 100; i++) {
    const factor = Math.pow(1 + r, n);
    const pv = mensualiteTotale * (factor - 1) / (r * factor);
    const dr = 0.00001;
    const factor2 = Math.pow(1 + r + dr, n);
    const pv2 = mensualiteTotale * (factor2 - 1) / ((r + dr) * factor2);
    const deriv = (pv2 - pv) / dr;
    const newR = r - (pv - montantEmprunte) / deriv;
    if (Math.abs(newR - r) < 1e-10) break;
    r = Math.max(0.0001, newR);
  }
  return r * 12 * 100;
}

/* ── Differe helpers ── */

/**
 * Compute credit payment for a given year, accounting for partial deferral.
 * During deferral months: pay only interest + insurance.
 * After deferral: normal amortization mensualite + insurance.
 */
function creditAnnee(
  montant: number,
  taux: number,
  dureeAns: number,
  differeMois: number,
  assuranceMensuelle: number,
  annee: number,
  typePret: 'amortissable' | 'in_fine',
): { mensualitesAnnee: number; interetsAnnee: number; capitalRembourse: number; crd: number } {
  if (montant <= 0) return { mensualitesAnnee: 0, interetsAnnee: 0, capitalRembourse: 0, crd: 0 };

  const tauxMensuel = taux / 12;
  const totalMoisCredit = dureeAns * 12;
  const moisDebut = (annee - 1) * 12;
  const moisFin = annee * 12;

  const dureeAmortMois = totalMoisCredit - differeMois;
  const mensualiteAmort = dureeAmortMois > 0
    ? calculerMensualiteAmortissable(montant, taux, dureeAmortMois / 12)
    : 0;

  let totalPaye = 0;
  let totalInterets = 0;
  let crd = montant;

  if (annee > 1) {
    for (let m = 0; m < moisDebut; m++) {
      if (m >= totalMoisCredit) { crd = 0; break; }
      if (m < differeMois) {
        // Differe: only interest, no capital
      } else {
        const interet = crd * tauxMensuel;
        const capital = mensualiteAmort - interet;
        crd = Math.max(0, crd - capital);
      }
    }
  }

  const crdDebutAnnee = crd;

  for (let m = moisDebut; m < moisFin; m++) {
    if (m >= totalMoisCredit) break;
    if (crd <= 0) break;

    if (m < differeMois) {
      const interet = crd * tauxMensuel;
      totalPaye += interet + assuranceMensuelle;
      totalInterets += interet;
    } else {
      if (typePret === 'in_fine') {
        const interet = crd * tauxMensuel;
        totalPaye += interet + assuranceMensuelle;
        totalInterets += interet;
        if (m === totalMoisCredit - 1) {
          totalPaye += crd;
          crd = 0;
        }
      } else {
        const interet = crd * tauxMensuel;
        const capital = mensualiteAmort - interet;
        totalPaye += mensualiteAmort + assuranceMensuelle;
        totalInterets += interet;
        crd = Math.max(0, crd - capital);
      }
    }
  }

  if (crd < 1) crd = 0;

  return {
    mensualitesAnnee: totalPaye,
    interetsAnnee: totalInterets,
    capitalRembourse: crdDebutAnnee - crd,
    crd,
  };
}

/* ── Year-by-year financial data (regime-independent) ── */

export interface YearlyFinancials {
  years: YearComputed[];
  fraisNotaire: number;
  assuranceAnnuelle: number;
  coutTotalAcquisition: number;
  loyerAnnuelBrut: number;
  loyerAnnuelNet: number;
  chargesAnnuellesTotales: number;
  mensualiteTotale: number;
  taeg: number;
  apportPersonnel: number;
}

/**
 * Compute all regime-independent yearly financial data for a projection.
 * This is what every regime computation shares.
 */
export function computeYearlyFinancials(inputs: CalculatorInputs): YearlyFinancials {
  const loyerMensuelTotal = inputs.lots && inputs.lots.length > 0
    ? inputs.lots.reduce((sum, lot) => sum + (lot.loyerMensuel || 0), 0)
    : inputs.loyerMensuel;

  const fraisNotaire = inputs.prixAchat * inputs.fraisNotairePct;
  const coutTotalAcquisition = inputs.prixAchat + fraisNotaire + inputs.fraisAgence
    + (inputs.fraisDossier ?? 0) + (inputs.fraisCourtage ?? 0) + inputs.montantTravaux;

  const assuranceAnnuelle = resolveAssuranceAnnuelle(inputs);
  const assuranceMensuelle = assuranceAnnuelle / 12;
  const differePretMois = inputs.differePretMois ?? 0;
  const differeLoyer = inputs.differeLoyer ?? 0;

  const dureeAmortMois = inputs.dureeCredit * 12 - differePretMois;
  const mensualiteCreditStandard = dureeAmortMois > 0
    ? calculerMensualiteAmortissable(inputs.montantEmprunte, inputs.tauxCredit, dureeAmortMois / 12)
    : 0;
  const mensualiteTotale = mensualiteCreditStandard + assuranceMensuelle;
  const taeg = calculerTAEG(inputs.montantEmprunte, inputs.tauxCredit, inputs.dureeCredit, assuranceAnnuelle);

  const loyerAnnuelBrut = loyerMensuelTotal * 12 + inputs.autresRevenusAnnuels;
  const loyerAnnuelNet = loyerAnnuelBrut * (1 - inputs.tauxVacance);

  const gestionLocative = loyerAnnuelNet * inputs.gestionLocativePct;
  const chargesAnnuellesTotales =
    inputs.chargesCopro + inputs.taxeFonciere + inputs.assurancePNO + gestionLocative
    + inputs.comptabilite + inputs.cfeCrl + inputs.entretien + inputs.gli + inputs.autresChargesAnnuelles;

  const apportPersonnel = inputs.apportPersonnel ?? Math.max(0, coutTotalAcquisition - inputs.montantEmprunte);

  // Yearly projection
  const evo = (key: string) => inputs.evolutions?.[key as keyof typeof inputs.evolutions] ?? 0;
  const baseGestionLoc = loyerAnnuelNet * inputs.gestionLocativePct;
  const baseCompta = inputs.comptabilite;
  const projectionYears = Math.max(inputs.dureeDetention, 25);

  const years: YearComputed[] = [];
  for (let annee = 1; annee <= projectionYears; annee++) {
    const yr = annee - 1;

    // Evolving loyer
    let yrLoyerBrut = loyerAnnuelBrut * Math.pow(1 + evo('lopiloyer'), yr);
    if (differeLoyer > 0 && annee === 1) {
      const moisAvecLoyer = Math.max(0, 12 - differeLoyer);
      yrLoyerBrut = (loyerMensuelTotal * moisAvecLoyer) + inputs.autresRevenusAnnuels;
    }
    const yrLoyerNet = yrLoyerBrut * (1 - inputs.tauxVacance);

    // Evolving charges
    const yrCopro = inputs.chargesCopro * Math.pow(1 + evo('chargesCopro'), yr);
    const yrTF = inputs.taxeFonciere * Math.pow(1 + evo('taxeFonciere'), yr);
    const yrPNO = inputs.assurancePNO * Math.pow(1 + evo('assurancePNO'), yr);
    const yrGestion = baseGestionLoc * Math.pow(1 + evo('gestionLocative'), yr);
    const yrCompta = baseCompta * Math.pow(1 + evo('comptabilite'), yr);
    const yrCFE = inputs.cfeCrl * Math.pow(1 + evo('cfeCrl'), yr);
    const yrEntretien = inputs.entretien * Math.pow(1 + evo('entretien'), yr);
    const yrGLI = inputs.gli * Math.pow(1 + evo('gli'), yr);
    const yrAutres = inputs.autresChargesAnnuelles * Math.pow(1 + evo('autresCharges'), yr);
    const yrCharges = yrCopro + yrTF + yrPNO + yrGestion + yrCompta + yrCFE + yrEntretien + yrGLI + yrAutres;

    const valeurBienInitiale = inputs.prixAchat + inputs.montantTravaux;
    const valeurBien = valeurBienInitiale * Math.pow(1 + inputs.tauxAppreciation, annee);
    const plusValue = valeurBien - valeurBienInitiale;

    const cr = creditAnnee(inputs.montantEmprunte, inputs.tauxCredit, inputs.dureeCredit, differePretMois, assuranceMensuelle, annee, inputs.typePret);

    years.push({
      loyerBrut: yrLoyerBrut,
      loyerNet: yrLoyerNet,
      charges: yrCharges,
      interets: cr.interetsAnnee,
      assurancePret: assuranceAnnuelle,
      mensualitesAnnee: cr.mensualitesAnnee,
      capitalRembourse: cr.capitalRembourse,
      crd: cr.crd,
      valeurBien,
      plusValue,
    });
  }

  return {
    years,
    fraisNotaire,
    assuranceAnnuelle,
    coutTotalAcquisition,
    loyerAnnuelBrut,
    loyerAnnuelNet,
    chargesAnnuellesTotales,
    mensualiteTotale,
    taeg,
    apportPersonnel,
  };
}

/* ── Main ── */

export function calculerRentabilite(inputs: CalculatorInputs): CalculatorResults {
  const fin = computeYearlyFinancials(inputs);

  const regime: RegimeFiscalType = toRegimeFiscalType(inputs.regimeFiscal);
  const regimeProjection = projeterAvecRegime(regime, inputs, fin.fraisNotaire, fin.years);
  const projection = regimeProjection.projection;

  // Year 1 KPIs
  const impotAnnuel = regimeProjection.impotAn1;
  const cashFlowAnnuelAvantImpot = projection[0]?.cashFlowAvantImpot ?? 0;
  const cashFlowAnnuelApresImpot = projection[0]?.cashFlowApresImpot ?? 0;

  const rBrut = rendementBrut(fin.loyerAnnuelBrut, fin.coutTotalAcquisition);
  const rNet = rendementNet(fin.loyerAnnuelNet, fin.chargesAnnuellesTotales, fin.coutTotalAcquisition);
  const rNetNet = rendementNetNet(fin.loyerAnnuelNet, fin.chargesAnnuellesTotales, impotAnnuel, fin.coutTotalAcquisition);

  // TRI 10 ans: CF apres impot + vente - CRD a l'annee 10
  const triCashFlows: number[] = [-fin.apportPersonnel];
  for (let i = 0; i < Math.min(10, projection.length); i++) {
    const p = projection[i];
    if (i < 9) {
      triCashFlows.push(p.cashFlowApresImpot);
    } else {
      triCashFlows.push(p.cashFlowApresImpot + p.valeurBien - p.capitalRestantDu);
    }
  }
  const tri = calculerTRI(triCashFlows);

  return {
    apportPersonnel: fin.apportPersonnel,
    rendementBrut: rBrut,
    rendementNet: rNet,
    rendementNetNet: rNetNet,
    cashFlowMensuelAvantImpot: cashFlowAnnuelAvantImpot / 12,
    cashFlowMensuelApresImpot: cashFlowAnnuelApresImpot / 12,
    cashFlowAnnuelAvantImpot,
    cashFlowAnnuelApresImpot,
    coutTotalAcquisition: fin.coutTotalAcquisition,
    loyerAnnuelBrut: fin.loyerAnnuelBrut,
    loyerAnnuelNet: fin.loyerAnnuelNet,
    chargesAnnuellesTotales: fin.chargesAnnuellesTotales,
    mensualiteCredit: fin.mensualiteTotale,
    taeg: fin.taeg,
    impotAnnuel,
    tri,
    triProjet: 0,
    projection,
  };
}

export { calculerMensualite, capitalRestantDu } from './loan';
export { rendementBrut, rendementNet } from './rendement';
