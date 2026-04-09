import type { AppData, CalculatorInputs } from "@/types";
import { mensualiserMontant, coutTotalBien } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
import { crdAtMonth, mensualiteAtMonth } from "@/lib/calculations/loan";
import { computeYearlyFinancials } from "@/lib/calculations";

/**
 * A point-in-time portfolio snapshot. All amounts are in EUR.
 */
export interface PortfolioSnapshot {
  nbBiens: number;
  nbCredits: number;

  // Patrimoine
  coutAcquisition: number;       // somme des couts (prix + frais + travaux)
  valeurPatrimoine: number;      // valeur estimee actuelle (avec appreciation)
  capitalRestantDu: number;      // somme des CRD restants
  apportGlobal: number;          // coutAcquisition - capitalInitialEmprunte
  patrimoineNet: number;         // valeur - CRD

  // Cashflow mensuel
  loyerMensuel: number;
  autresRevenusMensuels: number;
  depensesMensuelles: number;    // hors credit
  mensualitesCredit: number;     // incluant assurance emprunt
  cashFlowMensuel: number;

  // Ratios
  ltv: number;                   // loan-to-value = CRD / valeurPatrimoine
}

const EMPTY: PortfolioSnapshot = {
  nbBiens: 0,
  nbCredits: 0,
  coutAcquisition: 0,
  valeurPatrimoine: 0,
  capitalRestantDu: 0,
  apportGlobal: 0,
  patrimoineNet: 0,
  loyerMensuel: 0,
  autresRevenusMensuels: 0,
  depensesMensuelles: 0,
  mensualitesCredit: 0,
  cashFlowMensuel: 0,
  ltv: 0,
};

function yearsElapsedSince(dateISO: string): number {
  const start = new Date(dateISO);
  if (isNaN(start.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Compute snapshot from the real portfolio stored in AppData.
 * Applies a default appreciation rate to estimate current property values.
 */
export function computePortfolioSnapshot(
  data: AppData,
  appreciationAnnuelle = 0.02,
): PortfolioSnapshot {
  const { properties, expenses, incomes, loans } = data;
  if (properties.length === 0) return EMPTY;

  const coutAcquisition = properties.reduce((s, p) => s + coutTotalBien(p), 0);

  // Valeur estimee = prixAchat + travaux, projetee avec appreciation depuis dateSaisie
  const valeurPatrimoine = properties.reduce((s, p) => {
    const base = p.prixAchat + p.montantTravaux;
    const years = yearsElapsedSince(p.dateSaisie);
    return s + base * Math.pow(1 + appreciationAnnuelle, years);
  }, 0);

  // Credits: CRD actuel + mensualite courante (defer-aware)
  let capitalRestantDuTotal = 0;
  let mensualitesCreditTotal = 0;
  let totalEmprunte = 0;
  for (const loan of loans) {
    totalEmprunte += loan.montantEmprunte;
    const monthsElapsed = Math.max(
      0,
      Math.floor(yearsElapsedSince(loan.dateDebut) * 12),
    );
    const cappedMonth = Math.min(monthsElapsed, loan.dureeAnnees * 12 - 1);
    capitalRestantDuTotal += crdAtMonth(loan, cappedMonth);
    mensualitesCreditTotal += mensualiteAtMonth(loan, cappedMonth) + (loan.assuranceAnnuelle ?? 0) / 12;
  }

  const apportGlobal = Math.max(0, coutAcquisition - totalEmprunte);

  // Revenus mensuels (loyer + autres), hors ponctuels
  const loyerMensuel = incomes
    .filter((i) => i.categorie === "loyer" && i.frequence !== "ponctuel")
    .reduce((s, i) => s + mensualiserMontant(i.montant, i.frequence), 0);
  const autresRevenusMensuels = incomes
    .filter((i) => i.categorie !== "loyer" && i.frequence !== "ponctuel")
    .reduce((s, i) => s + mensualiserMontant(i.montant, i.frequence), 0);

  // Depenses mensuelles recurrentes hors credit
  const depensesMensuelles = expenses
    .filter((e) => e.categorie !== "credit" && e.frequence !== "ponctuel")
    .reduce((s, e) => s + mensualiserMontant(getCurrentMontant(e), e.frequence), 0);

  const cashFlowMensuel =
    loyerMensuel + autresRevenusMensuels - depensesMensuelles - mensualitesCreditTotal;

  return {
    nbBiens: properties.length,
    nbCredits: loans.length,
    coutAcquisition,
    valeurPatrimoine,
    capitalRestantDu: capitalRestantDuTotal,
    apportGlobal,
    patrimoineNet: valeurPatrimoine - capitalRestantDuTotal,
    loyerMensuel,
    autresRevenusMensuels,
    depensesMensuelles,
    mensualitesCredit: mensualitesCreditTotal,
    cashFlowMensuel,
    ltv: valeurPatrimoine > 0 ? capitalRestantDuTotal / valeurPatrimoine : 0,
  };
}

/**
 * Compute the contribution a simulation would add to the portfolio.
 * Uses year-1 figures (before any appreciation) to match a fresh acquisition.
 */
export function computeSimulationContribution(inputs: CalculatorInputs): PortfolioSnapshot {
  const fin = computeYearlyFinancials(inputs);
  const y0 = fin.years[0];
  if (!y0) return EMPTY;

  // Prix d'achat + travaux (valeur immediate du bien, pas de cout de transaction)
  const valeurPatrimoine = inputs.prixAchat + inputs.montantTravaux;

  // Year-1 monthly figures. Exclude vacance for cash flow reality (use loyerNet).
  const loyerMensuel = y0.loyerBrut / 12; // loyer brut "attendu"
  const depensesMensuelles = y0.charges / 12;
  const mensualitesCredit = y0.mensualitesAnnee / 12;
  const cashFlowMensuel = (y0.loyerNet - y0.charges - y0.mensualitesAnnee) / 12;

  return {
    nbBiens: 1,
    nbCredits: inputs.montantEmprunte > 0 ? 1 : 0,
    coutAcquisition: fin.coutTotalAcquisition,
    valeurPatrimoine,
    capitalRestantDu: inputs.montantEmprunte,
    apportGlobal: fin.apportPersonnel,
    patrimoineNet: valeurPatrimoine - inputs.montantEmprunte,
    loyerMensuel,
    autresRevenusMensuels: 0,
    depensesMensuelles,
    mensualitesCredit,
    cashFlowMensuel,
    ltv: valeurPatrimoine > 0 ? inputs.montantEmprunte / valeurPatrimoine : 0,
  };
}

/** Sum two snapshots. Ratios are recomputed from the combined totals. */
export function consolidateSnapshots(
  a: PortfolioSnapshot,
  b: PortfolioSnapshot,
): PortfolioSnapshot {
  const coutAcquisition = a.coutAcquisition + b.coutAcquisition;
  const valeurPatrimoine = a.valeurPatrimoine + b.valeurPatrimoine;
  const capitalRestantDu = a.capitalRestantDu + b.capitalRestantDu;

  return {
    nbBiens: a.nbBiens + b.nbBiens,
    nbCredits: a.nbCredits + b.nbCredits,
    coutAcquisition,
    valeurPatrimoine,
    capitalRestantDu,
    apportGlobal: a.apportGlobal + b.apportGlobal,
    patrimoineNet: valeurPatrimoine - capitalRestantDu,
    loyerMensuel: a.loyerMensuel + b.loyerMensuel,
    autresRevenusMensuels: a.autresRevenusMensuels + b.autresRevenusMensuels,
    depensesMensuelles: a.depensesMensuelles + b.depensesMensuelles,
    mensualitesCredit: a.mensualitesCredit + b.mensualitesCredit,
    cashFlowMensuel: a.cashFlowMensuel + b.cashFlowMensuel,
    ltv: valeurPatrimoine > 0 ? capitalRestantDu / valeurPatrimoine : 0,
  };
}
