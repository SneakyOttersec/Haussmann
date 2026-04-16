"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, SuiviMensuelLoyer, LotStatut } from "@/types";
import { generateId, now } from "@/lib/utils";

/**
 * Derive a lot's status from its most recent rent entry.
 * - If no entries exist, returns null (don't change current status).
 * - If the most recent entry is marked "vacant", lot is vacant.
 * - Otherwise (paid, partial, unpaid), lot is considered occupied.
 */
function deriveLotStatus(lotEntries: SuiviMensuelLoyer[]): LotStatut | null {
  if (lotEntries.length === 0) return null;
  const sorted = [...lotEntries].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  const latest = sorted[0].statut;
  return latest === "vacant" || latest === "travaux" ? "vacant" : "occupe";
}

/**
 * Hook for managing rent tracking entries.
 * Entries are keyed by (bienId, lotId, yearMonth) — upsert semantics.
 */
export function useSuiviLoyers(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  bienId?: string,
) {
  const allEntries = data?.suiviLoyers ?? [];
  const entries = useMemo(
    () => (bienId ? allEntries.filter((e) => e.bienId === bienId) : allEntries),
    [allEntries, bienId],
  );

  /** Find entry for a given lot + month. */
  const getEntry = useCallback(
    (lotId: string, yearMonth: string): SuiviMensuelLoyer | undefined => {
      return entries.find((e) => e.lotId === lotId && e.yearMonth === yearMonth);
    },
    [entries],
  );

  /**
   * Upsert an entry: if one exists for (lotId, yearMonth), update it.
   * Otherwise create a new entry. Also syncs the owning Lot's status to match
   * the most recent entry (see deriveLotStatus).
   */
  const upsertEntry = useCallback(
    (
      propId: string,
      lotId: string,
      yearMonth: string,
      updates: Partial<Omit<SuiviMensuelLoyer, "id" | "bienId" | "lotId" | "yearMonth" | "createdAt" | "updatedAt">>,
    ) => {
      const timestamp = now();
      setData((prev) => {
        const existing = (prev.suiviLoyers ?? []).find(
          (e) => e.lotId === lotId && e.yearMonth === yearMonth,
        );
        let nextRentTracking: SuiviMensuelLoyer[];
        if (existing) {
          nextRentTracking = (prev.suiviLoyers ?? []).map((e) =>
            e.id === existing.id ? { ...e, ...updates, updatedAt: timestamp } : e,
          );
        } else {
          const newEntry: SuiviMensuelLoyer = {
            id: generateId(),
            bienId: propId,
            lotId,
            yearMonth,
            loyerAttendu: 0,
            loyerPercu: 0,
            statut: "paye",
            ...updates,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          nextRentTracking = [...(prev.suiviLoyers ?? []), newEntry];
        }

        // Sync lot status based on the latest entry for this lot
        const lotEntries = nextRentTracking.filter((e) => e.lotId === lotId);
        const derived = deriveLotStatus(lotEntries);
        const nextLots = derived
          ? (prev.lots ?? []).map((l) => (l.id === lotId ? { ...l, statut: derived } : l))
          : prev.lots;

        return { ...prev, suiviLoyers: nextRentTracking, lots: nextLots };
      });
    },
    [setData],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setData((prev) => {
        const removed = (prev.suiviLoyers ?? []).find((e) => e.id === id);
        const nextRentTracking = (prev.suiviLoyers ?? []).filter((e) => e.id !== id);

        // Recompute lot status from remaining entries
        let nextLots = prev.lots;
        if (removed) {
          const lotEntries = nextRentTracking.filter((e) => e.lotId === removed.lotId);
          const derived = deriveLotStatus(lotEntries);
          if (derived) {
            nextLots = (prev.lots ?? []).map((l) => (l.id === removed.lotId ? { ...l, statut: derived } : l));
          }
        }

        return { ...prev, suiviLoyers: nextRentTracking, lots: nextLots };
      });
    },
    [setData],
  );

  return { entries, getEntry, upsertEntry, deleteEntry };
}
