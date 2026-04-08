"use client";

import { useCallback, useMemo } from "react";
import type { AppData, Lot, LotStatut, RentMonthEntry } from "@/types";
import { generateId } from "@/lib/utils";

/** Derive lot status from the most recent rent entry for this lot */
export function deriveLotStatut(lotId: string, rentEntries: RentMonthEntry[]): LotStatut | null {
  const entries = rentEntries.filter((e) => e.lotId === lotId);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  const latest = sorted[0].statut;
  return latest === "vacant" || latest === "travaux" ? "vacant" : "occupe";
}

export function useLots(
  data: AppData | null,
  setData: (updater: (prev: AppData) => AppData) => void,
  propertyId?: string
) {
  const all = data?.lots ?? [];
  const lots = useMemo(
    () => propertyId ? all.filter((l) => l.propertyId === propertyId) : all,
    [all, propertyId]
  );

  const addLot = useCallback(
    (item: Omit<Lot, "id">) => {
      setData((prev) => ({
        ...prev,
        lots: [...(prev.lots ?? []), { ...item, id: generateId() }],
      }));
    },
    [setData]
  );

  const updateLot = useCallback(
    (id: string, updates: Partial<Lot>) => {
      setData((prev) => ({
        ...prev,
        lots: (prev.lots ?? []).map((l) => (l.id === id ? { ...l, ...updates } : l)),
      }));
    },
    [setData]
  );

  const deleteLot = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, lots: (prev.lots ?? []).filter((l) => l.id !== id) }));
    },
    [setData]
  );

  return { lots, addLot, updateLot, deleteLot };
}
