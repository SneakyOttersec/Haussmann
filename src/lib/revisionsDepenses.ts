import type { Depense, RevisionDepense } from "@/types";

/** Convert a local Date to "YYYY-MM-DD" without timezone shift. */
function toLocalISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Return the montant effective on `referenceDate` for an depense.
 * Looks up the most recent revision whose dateEffet is ≤ referenceDate.
 * If no revision applies (depense has no revisions, or all are future),
 * returns depense.montant (the initial/base price).
 */
export function obtenirMontantEffectif(depense: Depense, referenceDate: Date): number {
  const revisions = depense.revisions ?? [];
  if (revisions.length === 0) return depense.montant;

  const refISO = toLocalISODate(referenceDate); // YYYY-MM-DD in local time
  // Find the latest revision with dateEffet ≤ refISO
  const applicable = revisions
    .filter((r) => r.dateEffet <= refISO)
    .sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));

  if (applicable.length === 0) return depense.montant;
  return applicable[0].montant;
}

/** Current effective price (today). */
export function obtenirMontantCourant(depense: Depense): number {
  return obtenirMontantEffectif(depense, new Date());
}

/** Montant at the START of a given year (Jan 1). */
export function getMontantForYear(depense: Depense, year: number): number {
  return obtenirMontantEffectif(depense, new Date(year, 0, 1));
}

/**
 * Return the effective price at the end of each year the depense has been active.
 * Useful to render an evolution table or sparkline.
 */
export function getYearlyMontants(
  depense: Depense,
  fromYear: number,
  toYear: number,
): { year: number; montant: number }[] {
  const out: { year: number; montant: number }[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    out.push({ year: y, montant: getMontantForYear(depense, y) });
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

export function getRevisionTimeline(depense: Depense): RevisionTimelineEntry[] {
  const initial: RevisionTimelineEntry = {
    dateEffet: depense.dateDebut,
    montant: depense.montant,
    isInitial: true,
  };
  const revs = (depense.revisions ?? []).map((r) => ({
    dateEffet: r.dateEffet,
    montant: r.montant,
    isInitial: false,
    id: r.id,
  }));
  return [initial, ...revs].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet));
}

/** Add a new revision and return the updated depense (immutable). */
export function addRevision(depense: Depense, revision: Omit<RevisionDepense, "id">): Depense {
  const newRevision: RevisionDepense = {
    ...revision,
    id: crypto.randomUUID(),
  };
  return { ...depense, revisions: [...(depense.revisions ?? []), newRevision] };
}

export function removeRevision(depense: Depense, revisionId: string): Depense {
  return { ...depense, revisions: (depense.revisions ?? []).filter((r) => r.id !== revisionId) };
}
