"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Intervention } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useInterventions(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  propertyId?: string
) {
  const all = data?.interventions ?? [];
  const interventions = useMemo(
    () => propertyId ? all.filter((i) => i.propertyId === propertyId) : all,
    [all, propertyId]
  );

  const ajouterIntervention = useCallback(
    (item: Omit<Intervention, "id" | "createdAt" | "updatedAt">) => {
      setData((prev) => ({
        ...prev,
        interventions: [...(prev.interventions ?? []), { ...item, id: generateId(), createdAt: now(), updatedAt: now() }],
      }));
    },
    [setData]
  );

  const mettreAJourIntervention = useCallback(
    (id: string, updates: Partial<Intervention>) => {
      setData((prev) => ({
        ...prev,
        interventions: (prev.interventions ?? []).map((i) => (i.id === id ? { ...i, ...updates, updatedAt: now() } : i)),
      }));
    },
    [setData]
  );

  const supprimerIntervention = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, interventions: (prev.interventions ?? []).filter((i) => i.id !== id) }));
    },
    [setData]
  );

  return { interventions, ajouterIntervention, mettreAJourIntervention, supprimerIntervention };
}
