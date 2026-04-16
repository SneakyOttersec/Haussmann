"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Revenu } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useIncomes(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  propertyId?: string
) {
  const allIncomes = data?.incomes ?? [];

  const incomes = useMemo(
    () => propertyId ? allIncomes.filter((i) => i.propertyId === propertyId) : allIncomes,
    [allIncomes, propertyId]
  );

  const addIncome = useCallback(
    (income: Omit<Revenu, "id" | "createdAt" | "updatedAt">) => {
      const newIncome: Revenu = {
        ...income,
        id: generateId(),
        createdAt: now(),
        updatedAt: now(),
      };
      setData((prev) => ({
        ...prev,
        incomes: [...prev.incomes, newIncome],
      }));
      return newIncome.id;
    },
    [setData]
  );

  const updateIncome = useCallback(
    (id: string, updates: Partial<Omit<Revenu, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        incomes: prev.incomes.map((i) =>
          i.id === id ? { ...i, ...updates, updatedAt: now() } : i
        ),
      }));
    },
    [setData]
  );

  const deleteIncome = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        incomes: prev.incomes.filter((i) => i.id !== id),
      }));
    },
    [setData]
  );

  return { incomes, addIncome, updateIncome, deleteIncome };
}
