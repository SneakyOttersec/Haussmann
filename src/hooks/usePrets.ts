"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Pret } from "@/types";
import { generateId } from "@/lib/utils";

export function usePrets(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  bienId?: string
) {
  const allLoans = data?.prets ?? [];

  const prets = useMemo(
    () => bienId ? allLoans.filter((l) => l.bienId === bienId) : allLoans,
    [allLoans, bienId]
  );

  const pret = bienId ? prets[0] ?? null : null;

  const setPret = useCallback(
    (loanData: Omit<Pret, "id">) => {
      setData((prev) => {
        const existing = prev.prets.find((l) => l.bienId === loanData.bienId);
        if (existing) {
          return {
            ...prev,
            prets: prev.prets.map((l) =>
              l.bienId === loanData.bienId ? { ...loanData, id: l.id } : l
            ),
          };
        }
        return {
          ...prev,
          prets: [...prev.prets, { ...loanData, id: generateId() }],
        };
      });
    },
    [setData]
  );

  const supprimerPret = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        prets: prev.prets.filter((l) => l.id !== id),
      }));
    },
    [setData]
  );

  return { prets, pret, setPret, supprimerPret };
}
