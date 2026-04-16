import type { Bien, Revenu, Depense, SuiviMensuelLoyer, Pret } from "@/types";
import { obtenirMontantEffectif } from "./revisionsDepenses";
import { getPropertyAcquisitionDate } from "./utils";
import { mensualiteAuMois, dureeTotaleMoisPret } from "./calculs/pret";

export interface MonthFlowData {
  yearMonth: string;          // "YYYY-MM"
  label: string;              // "mar 25"
  revenusLoyers: number;      // from rent tracking entries
  revenusAutres: number;      // other recurring revenus (non-loyer)
  depenses: number;           // non-credit depenses
  credit: number;             // credit depenses
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
 * Returns YYYY-MM for the start of the bien's exploitation window.
 * Uses dateSaisie as a proxy. Capped at `maxMonthsBack` months ago to avoid huge ranges.
 */
export function propertyStartYM(bien: Bien): string {
  const acqDate = getPropertyAcquisitionDate(bien);
  const d = new Date(acqDate);
  if (!isNaN(d.getTime())) return ymKey(d);
  const now = new Date();
  return ymKey(new Date(now.getFullYear(), now.getMonth() - 24, 1));
}

/** Amount of a recurring revenu/depense contributed to a specific month, proratized if needed. */
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
 * Build monthly flow data for a bien from exploitation start up to current month.
 * - Loyer revenus are taken from SuiviMensuelLoyer.loyerPercu (actual tracked values).
 * - Non-loyer revenus + depenses are projected from recurring entries.
 * - Credit: if `pret` is provided, the per-month payment is computed from the
 *   pret helpers (taking defer into account). Otherwise, the legacy behavior
 *   reads the auto-created "credit" depense — which doesn't model defer.
 */
export function buildMonthlyFlow(
  bien: Bien,
  revenus: Revenu[],
  depenses: Depense[],
  suiviLoyers: SuiviMensuelLoyer[],
  pret?: Pret | null,
): MonthFlowData[] {
  const startYM = propertyStartYM(bien);
  const [sy, sm] = startYM.split("-").map(Number);
  const start = new Date(sy, sm - 1, 1);
  const now = new Date();
  const currentYM = ymKey(now);

  const months: MonthFlowData[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  // Fast lookup of rent entries by yearMonth
  const rentByYM = new Map<string, number>();
  for (const e of suiviLoyers) {
    rentByYM.set(e.yearMonth, (rentByYM.get(e.yearMonth) ?? 0) + e.loyerPercu);
  }

  // Pre-compute pret start cursor for the per-month credit calculation.
  const loanStart = pret ? new Date(pret.dateDebut) : null;

  while (ymKey(cursor) <= currentYM) {
    const yearMonth = ymKey(cursor);
    let revenusAutres = 0;
    let totalDepenses = 0;
    let credit = 0;

    for (const inc of revenus) {
      if (inc.categorie === "loyer") continue; // loyer comes from suiviLoyers
      revenusAutres += monthlyContribution(inc.dateDebut, inc.dateFin, inc.montant, inc.frequence, cursor);
    }
    for (const exp of depenses) {
      // Skip the auto-created credit depense when we have a pret: we recompute
      // it from the pret schedule below to handle defer correctly.
      if (pret && exp.categorie === "credit") continue;
      const montantEff = obtenirMontantEffectif(exp, cursor);
      const montant = monthlyContribution(exp.dateDebut, exp.dateFin, montantEff, exp.frequence, cursor);
      if (exp.categorie === "credit") credit += montant;
      else totalDepenses += montant;
    }

    if (pret && loanStart && !isNaN(loanStart.getTime())) {
      const monthIdx = (cursor.getFullYear() - loanStart.getFullYear()) * 12
        + (cursor.getMonth() - loanStart.getMonth());
      if (monthIdx >= 0 && monthIdx < dureeTotaleMoisPret(pret)) {
        credit += mensualiteAuMois(pret, monthIdx) + pret.assuranceAnnuelle / 12;
      }
    }

    const revenusLoyers = rentByYM.get(yearMonth) ?? 0;
    const cashFlow = revenusLoyers + revenusAutres - totalDepenses - credit;

    months.push({
      yearMonth,
      label: monthLabel(cursor),
      revenusLoyers: Math.round(revenusLoyers),
      revenusAutres: Math.round(revenusAutres),
      depenses: Math.round(totalDepenses),
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
  last6Months: number | null; // sum of 6 last months, null if < 6 months of data
  nbMois: number;
}

export function computeCashflowStats(monthlyData: MonthFlowData[]): CashflowStats {
  if (monthlyData.length === 0) {
    return { global: 0, lastMonth: 0, last6Months: null, nbMois: 0 };
  }
  const global = monthlyData.reduce((s, m) => s + m.cashFlow, 0);
  const lastMonth = monthlyData[monthlyData.length - 1].cashFlow;
  const last6 = monthlyData.length >= 6
    ? monthlyData.slice(-6).reduce((s, m) => s + m.cashFlow, 0)
    : null;
  return { global, lastMonth, last6Months: last6, nbMois: monthlyData.length };
}

/**
 * Theoretical monthly cashflow based on recurring revenus and depenses (ignoring ponctuels).
 * This is what the bien "should" generate per month based on contracts/projections,
 * as opposed to the actual cashflow derived from rent tracking + bookkeeping.
 */
export function computeTheoreticalMonthlyCashflow(revenus: Revenu[], depenses: Depense[]): number {
  const mensualise = (montant: number, frequence: "mensuel" | "trimestriel" | "annuel" | "ponctuel") => {
    switch (frequence) {
      case "mensuel": return montant;
      case "trimestriel": return montant / 3;
      case "annuel": return montant / 12;
      case "ponctuel": return 0;
    }
  };
  const today = new Date();
  const totalRevenus = revenus.reduce((s, i) => s + mensualise(i.montant, i.frequence), 0);
  const totalDepenses = depenses.reduce((s, e) => s + mensualise(obtenirMontantEffectif(e, today), e.frequence), 0);
  return totalRevenus - totalDepenses;
}
