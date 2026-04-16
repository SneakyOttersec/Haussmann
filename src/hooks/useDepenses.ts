"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Depense } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useDepenses(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  propertyId?: string
) {
  const allExpenses = data?.expenses ?? [];

  const expenses = useMemo(
    () => propertyId ? allExpenses.filter((e) => e.propertyId === propertyId) : allExpenses,
    [allExpenses, propertyId]
  );

  const ajouterDepense = useCallback(
    (expense: Omit<Depense, "id" | "createdAt" | "updatedAt">) => {
      const newExpense: Depense = {
        ...expense,
        id: generateId(),
        createdAt: now(),
        updatedAt: now(),
      };
      setData((prev) => ({
        ...prev,
        expenses: [...prev.expenses, newExpense],
      }));
      return newExpense.id;
    },
    [setData]
  );

  const mettreAJourDepense = useCallback(
    (id: string, updates: Partial<Omit<Depense, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        expenses: prev.expenses.map((e) =>
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
        expenses: prev.expenses.filter((e) => e.id !== id),
      }));
    },
    [setData]
  );

  return { expenses, ajouterDepense, mettreAJourDepense, supprimerDepense };
}
