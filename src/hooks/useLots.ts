"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Lot, LotStatut, SuiviMensuelLoyer } from "@/types";
import { generateId } from "@/lib/utils";

/** Derive lot status from the most recent rent entry for this lot */
export function deriveLotStatut(lotId: string, suiviLoyers: SuiviMensuelLoyer[]): LotStatut | null {
  const entries = suiviLoyers.filter((e) => e.lotId === lotId);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  const latest = sorted[0].statut;
  return latest === "vacant" || latest === "travaux" ? "vacant" : "occupe";
}

export function useLots(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  bienId?: string
) {
  const all = data?.lots ?? [];
  const lots = useMemo(
    () => bienId ? all.filter((l) => l.bienId === bienId) : all,
    [all, bienId]
  );

  const ajouterLot = useCallback(
    (item: Omit<Lot, "id">) => {
      setData((prev) => ({
        ...prev,
        lots: [...(prev.lots ?? []), { ...item, id: generateId() }],
      }));
    },
    [setData]
  );

  const mettreAJourLot = useCallback(
    (id: string, updates: Partial<Lot>) => {
      setData((prev) => ({
        ...prev,
        lots: (prev.lots ?? []).map((l) => (l.id === id ? { ...l, ...updates } : l)),
      }));
    },
    [setData]
  );

  const supprimerLot = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, lots: (prev.lots ?? []).filter((l) => l.id !== id) }));
    },
    [setData]
  );

  return { lots, ajouterLot, mettreAJourLot, supprimerLot };
}
