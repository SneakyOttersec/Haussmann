"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Pret } from "@/types";
import { generateId } from "@/lib/utils";

export function usePrets(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  propertyId?: string
) {
  const allLoans = data?.loans ?? [];

  const loans = useMemo(
    () => propertyId ? allLoans.filter((l) => l.propertyId === propertyId) : allLoans,
    [allLoans, propertyId]
  );

  const loan = propertyId ? loans[0] ?? null : null;

  const setPret = useCallback(
    (loanData: Omit<Pret, "id">) => {
      setData((prev) => {
        const existing = prev.loans.find((l) => l.propertyId === loanData.propertyId);
        if (existing) {
          return {
            ...prev,
            loans: prev.loans.map((l) =>
              l.propertyId === loanData.propertyId ? { ...loanData, id: l.id } : l
            ),
          };
        }
        return {
          ...prev,
          loans: [...prev.loans, { ...loanData, id: generateId() }],
        };
      });
    },
    [setData]
  );

  const supprimerPret = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        loans: prev.loans.filter((l) => l.id !== id),
      }));
    },
    [setData]
  );

  return { loans, loan, setPret, supprimerPret };
}
