import type { CalculatorInputs, CalculatorResults, YearProjection } from '@/types';
import { calculerMensualite, calculerMensualiteAmortissable, capitalRestantDu, interetsAnnuels } from './loan';
import { rendementBrut, rendementNet, rendementNetNet } from './rendement';
import { calculerImpotIR } from './tax-ir';
import { calculerImpotIS, calculerAmortissementAnnee } from './tax-is';
import { calculerTRI } from './irr';

function resolveMontantMobilier(inputs: CalculatorInputs): number {
  if (inputs.lotsMobilier && inputs.lotsMobilier.length > 0) {
    return inputs.lotsMobilier.reduce((sum, lot) => sum + (lot.montant || 0), 0);
  }
  return 0;
}

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
 * Returns { mensualitesAnnee, interetsAnnee, capitalRembourse }
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
  const moisDebut = (annee - 1) * 12; // month index at start of this year (0-based)
  const moisFin = annee * 12;

  // Durée amortissement = durée totale - différé
  const dureeAmortMois = totalMoisCredit - differeMois;
  const mensualiteAmort = dureeAmortMois > 0
    ? calculerMensualiteAmortissable(montant, taux, dureeAmortMois / 12)
    : 0;
  const mensualiteDiffere = montant * tauxMensuel; // intérêts seulement

  let totalPaye = 0;
  let totalInterets = 0;
  let crd = montant;

  // Compute CRD at start of year by simulating from month 0
  if (annee > 1) {
    for (let m = 0; m < moisDebut; m++) {
      if (m >= totalMoisCredit) { crd = 0; break; }
      if (m < differeMois) {
        // Différé: only interest, no capital
      } else {
        // Amortization
        const interet = crd * tauxMensuel;
        const capital = mensualiteAmort - interet;
        crd = Math.max(0, crd - capital);
      }
    }
  }

  const crdDebutAnnee = crd;

  // Process 12 months of this year
  for (let m = moisDebut; m < moisFin; m++) {
    if (m >= totalMoisCredit) {
      // Loan finished
      break;
    }
    if (crd <= 0) break;

    if (m < differeMois) {
      // Différé partiel: interest only
      const interet = crd * tauxMensuel;
      totalPaye += interet + assuranceMensuelle;
      totalInterets += interet;
    } else {
      if (typePret === 'in_fine') {
        const interet = crd * tauxMensuel;
        totalPaye += interet + assuranceMensuelle;
        totalInterets += interet;
        // Capital repaid at maturity
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

  // Snap to 0 for floating point precision
  if (crd < 1) crd = 0;

  return {
    mensualitesAnnee: totalPaye,
    interetsAnnee: totalInterets,
    capitalRembourse: crdDebutAnnee - crd,
    crd,
  };
}

/* ── Main ── */

export function calculerRentabilite(inputs: CalculatorInputs): CalculatorResults {
  const loyerMensuelTotal = inputs.lots && inputs.lots.length > 0
    ? inputs.lots.reduce((sum, lot) => sum + (lot.loyerMensuel || 0), 0)
    : inputs.loyerMensuel;

  const fraisNotaire = inputs.prixAchat * inputs.fraisNotairePct;
  const coutTotalAcquisition = inputs.prixAchat + fraisNotaire + inputs.fraisAgence + (inputs.fraisDossier ?? 0) + (inputs.fraisCourtage ?? 0) + inputs.montantTravaux;

  const assuranceAnnuelle = resolveAssuranceAnnuelle(inputs);
  const assuranceMensuelle = assuranceAnnuelle / 12;

  const differePretMois = inputs.differePretMois ?? 0;
  const differeLoyer = inputs.differeLoyer ?? 0;

  // Mensualite standard (post-differe) for display
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
    inputs.chargesCopro +
    inputs.taxeFonciere +
    inputs.assurancePNO +
    gestionLocative +
    inputs.comptabilite +
    inputs.cfeCrl +
    inputs.entretien +
    inputs.gli +
    inputs.autresChargesAnnuelles;

  const rBrut = rendementBrut(loyerAnnuelBrut, coutTotalAcquisition);
  const rNet = rendementNet(loyerAnnuelNet, chargesAnnuellesTotales, coutTotalAcquisition);

  // Year 1 tax (for KPI display)
  const credit1 = creditAnnee(inputs.montantEmprunte, inputs.tauxCredit, inputs.dureeCredit, differePretMois, assuranceMensuelle, 1, inputs.typePret);
  let impotAnnuel = 0;

  if (inputs.regimeFiscal === 'IR') {
    const revenuFoncierNet = loyerAnnuelNet - chargesAnnuellesTotales - credit1.interetsAnnee - assuranceAnnuelle;
    impotAnnuel = calculerImpotIR(revenuFoncierNet, inputs.trancheMarginalePct ?? 0.30);
  } else {
    const amortAn1 = calculerAmortissementAnnee(inputs, fraisNotaire, 1);
    const resultatFiscal = loyerAnnuelNet - chargesAnnuellesTotales - amortAn1 - credit1.interetsAnnee - assuranceAnnuelle;
    impotAnnuel = calculerImpotIS(resultatFiscal);
  }

  const rNetNet = rendementNetNet(loyerAnnuelNet, chargesAnnuellesTotales, impotAnnuel, coutTotalAcquisition);

  const cashFlowAnnuelAvantImpot = loyerAnnuelNet - credit1.mensualitesAnnee - chargesAnnuellesTotales;
  const cashFlowAnnuelApresImpot = cashFlowAnnuelAvantImpot - impotAnnuel;
  const cashFlowMensuelAvantImpot = cashFlowAnnuelAvantImpot / 12;
  const cashFlowMensuelApresImpot = cashFlowAnnuelApresImpot / 12;

  const apportPersonnel = inputs.apportPersonnel ?? Math.max(0, coutTotalAcquisition - inputs.montantEmprunte);
  const projection: YearProjection[] = [];
  const triCashFlows: number[] = [-apportPersonnel];
  const triProjetFlows: number[] = [-coutTotalAcquisition];

  const evo = (key: string) => inputs.evolutions?.[key as keyof typeof inputs.evolutions] ?? 0;
  const baseLoyerBrut = loyerAnnuelBrut;
  const baseGestionLoc = loyerAnnuelNet * inputs.gestionLocativePct;
  const lotsCount = inputs.lots?.length || 1;
  const baseCompta = inputs.comptabilite;

  let reportDeficitIS = 0; // Deficit reportable IS (amortissement non utilise)

  const projectionYears = Math.max(inputs.dureeDetention, 25);

  for (let annee = 1; annee <= projectionYears; annee++) {
    const yr = annee - 1;

    // Evolving loyer
    let yrLoyerBrut = baseLoyerBrut * Math.pow(1 + evo('lopiloyer'), yr);

    // Différé loyer: reduce income in months where no rent is collected
    if (differeLoyer > 0 && annee === 1) {
      // In year 1, only (12 - differeLoyer) months of rent
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

    const valeurBien = inputs.prixAchat * Math.pow(1 + inputs.tauxAppreciation, annee);
    const plusValue = valeurBien - inputs.prixAchat;

    // Credit with deferral
    const cr = creditAnnee(inputs.montantEmprunte, inputs.tauxCredit, inputs.dureeCredit, differePretMois, assuranceMensuelle, annee, inputs.typePret);

    let impot = 0;
    if (inputs.regimeFiscal === 'IR') {
      const revFoncierNet = yrLoyerNet - yrCharges - cr.interetsAnnee - assuranceAnnuelle;
      impot = calculerImpotIR(revFoncierNet, inputs.trancheMarginalePct ?? 0.30);
    } else {
      const amortAnnee = calculerAmortissementAnnee(inputs, fraisNotaire, annee);
      // Resultat avant report = revenus - charges - amortissement - interets - assurance
      let resultatAvantReport = yrLoyerNet - yrCharges - amortAnnee - cr.interetsAnnee - assuranceAnnuelle;
      // Apply deficit carryforward: reduce taxable result by accumulated deficit
      let resultatFiscal = resultatAvantReport + reportDeficitIS; // reportDeficitIS is negative
      if (resultatFiscal < 0) {
        // Still in deficit: no tax, carry forward the total deficit
        reportDeficitIS = resultatFiscal;
        impot = 0;
      } else {
        // Positive result after absorbing deficit: pay tax on remainder
        reportDeficitIS = 0;
        impot = calculerImpotIS(resultatFiscal);
      }
    }

    const cfAvantImpot = yrLoyerNet - cr.mensualitesAnnee - yrCharges;
    const cfApresImpot = cfAvantImpot - impot;

    projection.push({
      annee,
      loyerBrut: yrLoyerBrut,
      loyerNet: yrLoyerNet,
      charges: yrCharges,
      interets: cr.interetsAnnee,
      capitalRembourse: cr.capitalRembourse,
      mensualitesCredit: cr.mensualitesAnnee,
      cashFlowAvantImpot: cfAvantImpot,
      impot,
      cashFlowApresImpot: cfApresImpot,
      capitalRestantDu: cr.crd,
      valeurBien,
      plusValue,
    });

    // TRI investisseur (levered): CF apres impot + vente - CRD a la sortie
    if (annee < inputs.dureeDetention) {
      triCashFlows.push(cfApresImpot);
    } else if (annee === inputs.dureeDetention) {
      triCashFlows.push(cfApresImpot + valeurBien - cr.crd);
    }

    // TRI projet (unlevered): revenus nets - charges, sans credit
    if (annee < inputs.dureeDetention) {
      triProjetFlows.push(yrLoyerNet - yrCharges);
    } else if (annee === inputs.dureeDetention) {
      triProjetFlows.push(yrLoyerNet - yrCharges + valeurBien);
    }
  }

  const tri = calculerTRI(triCashFlows);
  const triProjet = calculerTRI(triProjetFlows);

  return {
    apportPersonnel,
    rendementBrut: rBrut,
    rendementNet: rNet,
    rendementNetNet: rNetNet,
    cashFlowMensuelAvantImpot,
    cashFlowMensuelApresImpot,
    cashFlowAnnuelAvantImpot,
    cashFlowAnnuelApresImpot,
    coutTotalAcquisition,
    loyerAnnuelBrut,
    loyerAnnuelNet,
    chargesAnnuellesTotales,
    mensualiteCredit: mensualiteTotale,
    taeg,
    impotAnnuel,
    tri,
    triProjet,
    projection,
  };
}

export { calculerMensualite, capitalRestantDu } from './loan';
export { rendementBrut, rendementNet } from './rendement';
