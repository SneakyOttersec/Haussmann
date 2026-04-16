"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Revenu } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useRevenus(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  bienId?: string
) {
  const allIncomes = data?.revenus ?? [];

  const revenus = useMemo(
    () => bienId ? allIncomes.filter((i) => i.bienId === bienId) : allIncomes,
    [allIncomes, bienId]
  );

  const ajouterRevenu = useCallback(
    (revenu: Omit<Revenu, "id" | "createdAt" | "updatedAt">) => {
      const newIncome: Revenu = {
        ...revenu,
        id: generateId(),
        createdAt: now(),
        updatedAt: now(),
      };
      setData((prev) => ({
        ...prev,
        revenus: [...prev.revenus, newIncome],
      }));
      return newIncome.id;
    },
    [setData]
  );

  const mettreAJourRevenu = useCallback(
    (id: string, updates: Partial<Omit<Revenu, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        revenus: prev.revenus.map((i) =>
          i.id === id ? { ...i, ...updates, updatedAt: now() } : i
        ),
      }));
    },
    [setData]
  );

  const supprimerRevenu = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        revenus: prev.revenus.filter((i) => i.id !== id),
      }));
    },
    [setData]
  );

  return { revenus, ajouterRevenu, mettreAJourRevenu, supprimerRevenu };
}
