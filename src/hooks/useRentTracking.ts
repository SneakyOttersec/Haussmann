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
 * Entries are keyed by (propertyId, lotId, yearMonth) — upsert semantics.
 */
export function useRentTracking(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  propertyId?: string,
) {
  const allEntries = data?.rentTracking ?? [];
  const entries = useMemo(
    () => (propertyId ? allEntries.filter((e) => e.propertyId === propertyId) : allEntries),
    [allEntries, propertyId],
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
      updates: Partial<Omit<SuiviMensuelLoyer, "id" | "propertyId" | "lotId" | "yearMonth" | "createdAt" | "updatedAt">>,
    ) => {
      const timestamp = now();
      setData((prev) => {
        const existing = (prev.rentTracking ?? []).find(
          (e) => e.lotId === lotId && e.yearMonth === yearMonth,
        );
        let nextRentTracking: SuiviMensuelLoyer[];
        if (existing) {
          nextRentTracking = (prev.rentTracking ?? []).map((e) =>
            e.id === existing.id ? { ...e, ...updates, updatedAt: timestamp } : e,
          );
        } else {
          const newEntry: SuiviMensuelLoyer = {
            id: generateId(),
            propertyId: propId,
            lotId,
            yearMonth,
            loyerAttendu: 0,
            loyerPercu: 0,
            statut: "paye",
            ...updates,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          nextRentTracking = [...(prev.rentTracking ?? []), newEntry];
        }

        // Sync lot status based on the latest entry for this lot
        const lotEntries = nextRentTracking.filter((e) => e.lotId === lotId);
        const derived = deriveLotStatus(lotEntries);
        const nextLots = derived
          ? (prev.lots ?? []).map((l) => (l.id === lotId ? { ...l, statut: derived } : l))
          : prev.lots;

        return { ...prev, rentTracking: nextRentTracking, lots: nextLots };
      });
    },
    [setData],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setData((prev) => {
        const removed = (prev.rentTracking ?? []).find((e) => e.id === id);
        const nextRentTracking = (prev.rentTracking ?? []).filter((e) => e.id !== id);

        // Recompute lot status from remaining entries
        let nextLots = prev.lots;
        if (removed) {
          const lotEntries = nextRentTracking.filter((e) => e.lotId === removed.lotId);
          const derived = deriveLotStatus(lotEntries);
          if (derived) {
            nextLots = (prev.lots ?? []).map((l) => (l.id === removed.lotId ? { ...l, statut: derived } : l));
          }
        }

        return { ...prev, rentTracking: nextRentTracking, lots: nextLots };
      });
    },
    [setData],
  );

  return { entries, getEntry, upsertEntry, deleteEntry };
}
