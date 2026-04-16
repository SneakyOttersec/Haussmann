"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, PaiementCharge } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useChargePayments(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  bienId?: string,
) {
  const allEntries = data?.paiementsCharges ?? [];
  const entries = useMemo(
    () => (bienId ? allEntries.filter((e) => e.bienId === bienId) : allEntries),
    [allEntries, bienId],
  );

  const getEntry = useCallback(
    (depenseId: string, periode: string): PaiementCharge | undefined => {
      return entries.find((e) => e.depenseId === depenseId && e.periode === periode);
    },
    [entries],
  );

  const upsertEntry = useCallback(
    (
      propId: string,
      depenseId: string,
      periode: string,
      updates: Partial<Omit<PaiementCharge, "id" | "bienId" | "depenseId" | "periode" | "createdAt" | "updatedAt">>,
    ) => {
      const timestamp = now();
      setData((prev) => {
        const existing = (prev.paiementsCharges ?? []).find(
          (e) => e.depenseId === depenseId && e.periode === periode,
        );
        if (existing) {
          return {
            ...prev,
            paiementsCharges: (prev.paiementsCharges ?? []).map((e) =>
              e.id === existing.id ? { ...e, ...updates, updatedAt: timestamp } : e,
            ),
          };
        }
        const newEntry: PaiementCharge = {
          id: generateId(),
          depenseId,
          bienId: propId,
          periode,
          montantAttendu: 0,
          montantPaye: 0,
          statut: "en_attente",
          ...updates,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        return {
          ...prev,
          paiementsCharges: [...(prev.paiementsCharges ?? []), newEntry],
        };
      });
    },
    [setData],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        paiementsCharges: (prev.paiementsCharges ?? []).filter((e) => e.id !== id),
      }));
    },
    [setData],
  );

  return { entries, getEntry, upsertEntry, deleteEntry };
}
