"use client";

import { useCallback, useMemo } from "react";
import type { AppData, Intervention } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useInterventions(
  data: AppData | null,
  setData: (updater: (prev: AppData) => AppData) => void,
  propertyId?: string
) {
  const all = data?.interventions ?? [];
  const interventions = useMemo(
    () => propertyId ? all.filter((i) => i.propertyId === propertyId) : all,
    [all, propertyId]
  );

  const addIntervention = useCallback(
    (item: Omit<Intervention, "id" | "createdAt" | "updatedAt">) => {
      setData((prev) => ({
        ...prev,
        interventions: [...(prev.interventions ?? []), { ...item, id: generateId(), createdAt: now(), updatedAt: now() }],
      }));
    },
    [setData]
  );

  const updateIntervention = useCallback(
    (id: string, updates: Partial<Intervention>) => {
      setData((prev) => ({
        ...prev,
        interventions: (prev.interventions ?? []).map((i) => (i.id === id ? { ...i, ...updates, updatedAt: now() } : i)),
      }));
    },
    [setData]
  );

  const deleteIntervention = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, interventions: (prev.interventions ?? []).filter((i) => i.id !== id) }));
    },
    [setData]
  );

  return { interventions, addIntervention, updateIntervention, deleteIntervention };
}
