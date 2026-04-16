"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Depense } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useDepenses(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  bienId?: string
) {
  const allExpenses = data?.depenses ?? [];

  const depenses = useMemo(
    () => bienId ? allExpenses.filter((e) => e.bienId === bienId) : allExpenses,
    [allExpenses, bienId]
  );

  const ajouterDepense = useCallback(
    (depense: Omit<Depense, "id" | "createdAt" | "updatedAt">) => {
      const newExpense: Depense = {
        ...depense,
        id: generateId(),
        createdAt: now(),
        updatedAt: now(),
      };
      setData((prev) => ({
        ...prev,
        depenses: [...prev.depenses, newExpense],
      }));
      return newExpense.id;
    },
    [setData]
  );

  const mettreAJourDepense = useCallback(
    (id: string, updates: Partial<Omit<Depense, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        depenses: prev.depenses.map((e) =>
          e.id === id ? { ...e, ...updates, updatedAt: now() } : e
        ),
      }));
    },
    [setData]
  );

  const supprimerDepense = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        depenses: prev.depenses.filter((e) => e.id !== id),
      }));
    },
    [setData]
  );

  return { depenses, ajouterDepense, mettreAJourDepense, supprimerDepense };
}
