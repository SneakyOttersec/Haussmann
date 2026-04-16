"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Depense } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useExpenses(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  propertyId?: string
) {
  const allExpenses = data?.expenses ?? [];

  const expenses = useMemo(
    () => propertyId ? allExpenses.filter((e) => e.propertyId === propertyId) : allExpenses,
    [allExpenses, propertyId]
  );

  const addExpense = useCallback(
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

  const updateExpense = useCallback(
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

  const deleteExpense = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== id),
      }));
    },
    [setData]
  );

  return { expenses, addExpense, updateExpense, deleteExpense };
}
