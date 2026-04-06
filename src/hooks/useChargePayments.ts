"use client";

import { useCallback, useMemo } from "react";
import type { AppData, ChargePaymentEntry } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useChargePayments(
  data: AppData | null,
  setData: (updater: (prev: AppData) => AppData) => void,
  propertyId?: string,
) {
  const allEntries = data?.chargePayments ?? [];
  const entries = useMemo(
    () => (propertyId ? allEntries.filter((e) => e.propertyId === propertyId) : allEntries),
    [allEntries, propertyId],
  );

  const getEntry = useCallback(
    (expenseId: string, periode: string): ChargePaymentEntry | undefined => {
      return entries.find((e) => e.expenseId === expenseId && e.periode === periode);
    },
    [entries],
  );

  const upsertEntry = useCallback(
    (
      propId: string,
      expenseId: string,
      periode: string,
      updates: Partial<Omit<ChargePaymentEntry, "id" | "propertyId" | "expenseId" | "periode" | "createdAt" | "updatedAt">>,
    ) => {
      const timestamp = now();
      setData((prev) => {
        const existing = (prev.chargePayments ?? []).find(
          (e) => e.expenseId === expenseId && e.periode === periode,
        );
        if (existing) {
          return {
            ...prev,
            chargePayments: (prev.chargePayments ?? []).map((e) =>
              e.id === existing.id ? { ...e, ...updates, updatedAt: timestamp } : e,
            ),
          };
        }
        const newEntry: ChargePaymentEntry = {
          id: generateId(),
          expenseId,
          propertyId: propId,
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
          chargePayments: [...(prev.chargePayments ?? []), newEntry],
        };
      });
    },
    [setData],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        chargePayments: (prev.chargePayments ?? []).filter((e) => e.id !== id),
      }));
    },
    [setData],
  );

  return { entries, getEntry, upsertEntry, deleteEntry };
}
