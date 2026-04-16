import type { Depense, RevisionDepense } from "@/types";

/** Convert a local Date to "YYYY-MM-DD" without timezone shift. */
function toLocalISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Return the montant effective on `referenceDate` for an expense.
 * Looks up the most recent revision whose dateEffet is ≤ referenceDate.
 * If no revision applies (expense has no revisions, or all are future),
 * returns expense.montant (the initial/base price).
 */
export function getMontantEffectif(expense: Depense, referenceDate: Date): number {
  const revisions = expense.revisions ?? [];
  if (revisions.length === 0) return expense.montant;

  const refISO = toLocalISODate(referenceDate); // YYYY-MM-DD in local time
  // Find the latest revision with dateEffet ≤ refISO
  const applicable = revisions
    .filter((r) => r.dateEffet <= refISO)
    .sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));

  if (applicable.length === 0) return expense.montant;
  return applicable[0].montant;
}

/** Current effective price (today). */
export function getCurrentMontant(expense: Depense): number {
  return getMontantEffectif(expense, new Date());
}

/** Montant at the START of a given year (Jan 1). */
export function getMontantForYear(expense: Depense, year: number): number {
  return getMontantEffectif(expense, new Date(year, 0, 1));
}

/**
 * Return the effective price at the end of each year the expense has been active.
 * Useful to render an evolution table or sparkline.
 */
export function getYearlyMontants(
  expense: Depense,
  fromYear: number,
  toYear: number,
): { year: number; montant: number }[] {
  const out: { year: number; montant: number }[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    out.push({ year: y, montant: getMontantForYear(expense, y) });
  }
  return out;
}

/** Sorted revisions, most recent first, including the initial (base) as an implicit entry. */
export interface RevisionTimelineEntry {
  dateEffet: string;
  montant: number;
  isInitial: boolean;
  id?: string;
}

export function getRevisionTimeline(expense: Depense): RevisionTimelineEntry[] {
  const initial: RevisionTimelineEntry = {
    dateEffet: expense.dateDebut,
    montant: expense.montant,
    isInitial: true,
  };
  const revs = (expense.revisions ?? []).map((r) => ({
    dateEffet: r.dateEffet,
    montant: r.montant,
    isInitial: false,
    id: r.id,
  }));
  return [initial, ...revs].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
}

/** Add a new revision and return the updated expense (immutable). */
export function addRevision(expense: Depense, revision: Omit<RevisionDepense, "id">): Depense {
  const newRevision: RevisionDepense = {
    ...revision,
    id: crypto.randomUUID(),
  };
  return { ...expense, revisions: [...(expense.revisions ?? []), newRevision] };
}

export function removeRevision(expense: Depense, revisionId: string): Depense {
  return { ...expense, revisions: (expense.revisions ?? []).filter((r) => r.id !== revisionId) };
}
