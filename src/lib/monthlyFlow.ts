import type { Property, Income, Expense, RentMonthEntry } from "@/types";
import { getMontantEffectif } from "./expenseRevisions";

export interface MonthFlowData {
  yearMonth: string;          // "YYYY-MM"
  label: string;              // "mar 25"
  revenusLoyers: number;      // from rent tracking entries
  revenusAutres: number;      // other recurring incomes (non-loyer)
  depenses: number;           // non-credit expenses
  credit: number;             // credit expenses
  cashFlow: number;
}

/** Format "YYYY-MM" */
function ymKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

/**
 * Returns YYYY-MM for the start of the property's exploitation window.
 * Uses dateAchat as a proxy. Capped at `maxMonthsBack` months ago to avoid huge ranges.
 */
export function propertyStartYM(property: Property, maxMonthsBack = 60): string {
  const now = new Date();
  const minDate = new Date(now.getFullYear(), now.getMonth() - maxMonthsBack, 1);
  const achat = property.dateAchat ? new Date(property.dateAchat) : null;
  const start = achat && !isNaN(achat.getTime()) && achat > minDate ? achat : minDate;
  return ymKey(start);
}

/** Amount of a recurring income/expense contributed to a specific month, proratized if needed. */
function monthlyContribution(
  dateDebut: string,
  dateFin: string | undefined,
  montant: number,
  frequence: "mensuel" | "trimestriel" | "annuel" | "ponctuel",
  d: Date,
): number {
  const start = new Date(dateDebut);
  const end = dateFin ? new Date(dateFin) : null;
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  if (start > monthEnd) return 0;
  if (end && end < monthStart) return 0;

  if (frequence === "ponctuel") {
    return start.getFullYear() === d.getFullYear() && start.getMonth() === d.getMonth() ? montant : 0;
  }
  if (frequence === "mensuel") return montant;
  if (frequence === "trimestriel") {
    const monthsDiff = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    return monthsDiff >= 0 && monthsDiff % 3 === 0 ? montant : 0;
  }
  if (frequence === "annuel") return montant / 12;
  return 0;
}

/**
 * Build monthly flow data for a property from exploitation start up to current month.
 * - Loyer incomes are taken from RentMonthEntry.loyerPercu (actual tracked values).
 * - Non-loyer incomes + expenses + credit are projected from recurring entries.
 */
export function buildMonthlyFlow(
  property: Property,
  incomes: Income[],
  expenses: Expense[],
  rentEntries: RentMonthEntry[],
): MonthFlowData[] {
  const startYM = propertyStartYM(property);
  const [sy, sm] = startYM.split("-").map(Number);
  const start = new Date(sy, sm - 1, 1);
  const now = new Date();
  const currentYM = ymKey(now);

  const months: MonthFlowData[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  // Fast lookup of rent entries by yearMonth
  const rentByYM = new Map<string, number>();
  for (const e of rentEntries) {
    rentByYM.set(e.yearMonth, (rentByYM.get(e.yearMonth) ?? 0) + e.loyerPercu);
  }

  while (ymKey(cursor) <= currentYM) {
    const yearMonth = ymKey(cursor);
    let revenusAutres = 0;
    let depenses = 0;
    let credit = 0;

    for (const inc of incomes) {
      if (inc.categorie === "loyer") continue; // loyer comes from rentEntries
      revenusAutres += monthlyContribution(inc.dateDebut, inc.dateFin, inc.montant, inc.frequence, cursor);
    }
    for (const exp of expenses) {
      const montantEff = getMontantEffectif(exp, cursor);
      const montant = monthlyContribution(exp.dateDebut, exp.dateFin, montantEff, exp.frequence, cursor);
      if (exp.categorie === "credit") credit += montant;
      else depenses += montant;
    }

    const revenusLoyers = rentByYM.get(yearMonth) ?? 0;
    const cashFlow = revenusLoyers + revenusAutres - depenses - credit;

    months.push({
      yearMonth,
      label: monthLabel(cursor),
      revenusLoyers: Math.round(revenusLoyers),
      revenusAutres: Math.round(revenusAutres),
      depenses: Math.round(depenses),
      credit: Math.round(credit),
      cashFlow: Math.round(cashFlow),
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

export interface CashflowStats {
  global: number;      // cumulative since exploitation
  lastMonth: number;   // last completed month
  last6Months: number; // sum of 6 last months
  nbMois: number;
}

export function computeCashflowStats(monthlyData: MonthFlowData[]): CashflowStats {
  if (monthlyData.length === 0) {
    return { global: 0, lastMonth: 0, last6Months: 0, nbMois: 0 };
  }
  const global = monthlyData.reduce((s, m) => s + m.cashFlow, 0);
  const lastMonth = monthlyData[monthlyData.length - 1].cashFlow;
  const last6 = monthlyData.slice(-6).reduce((s, m) => s + m.cashFlow, 0);
  return { global, lastMonth, last6Months: last6, nbMois: monthlyData.length };
}

/**
 * Theoretical monthly cashflow based on recurring incomes and expenses (ignoring ponctuels).
 * This is what the property "should" generate per month based on contracts/projections,
 * as opposed to the actual cashflow derived from rent tracking + bookkeeping.
 */
export function computeTheoreticalMonthlyCashflow(incomes: Income[], expenses: Expense[]): number {
  const mensualise = (montant: number, frequence: "mensuel" | "trimestriel" | "annuel" | "ponctuel") => {
    switch (frequence) {
      case "mensuel": return montant;
      case "trimestriel": return montant / 3;
      case "annuel": return montant / 12;
      case "ponctuel": return 0;
    }
  };
  const today = new Date();
  const revenus = incomes.reduce((s, i) => s + mensualise(i.montant, i.frequence), 0);
  const depenses = expenses.reduce((s, e) => s + mensualise(getMontantEffectif(e, today), e.frequence), 0);
  return revenus - depenses;
}
