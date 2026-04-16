"use client";

import { useCallback } from "react";
import type { DonneesApp, Bien } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useBiens(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void
) {
  const allProperties = data?.properties ?? [];
  const properties = allProperties.filter((p) => !p.deletedAt);
  const biensSupprimes = allProperties.filter((p) => p.deletedAt);

  const ajouterBien = useCallback(
    (property: Omit<Bien, "id" | "createdAt" | "updatedAt">) => {
      const newProperty: Bien = {
        ...property,
        id: generateId(),
        createdAt: now(),
        updatedAt: now(),
      };
      setData((prev) => ({
        ...prev,
        properties: [...prev.properties, newProperty],
      }));
      return newProperty.id;
    },
    [setData]
  );

  const mettreAJourBien = useCallback(
    (id: string, updates: Partial<Omit<Bien, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: now() } : p
        ),
      }));
    },
    [setData]
  );

  /** Soft-delete: marks the property as deleted without removing data */
  const supprimerBien = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === id ? { ...p, deletedAt: now(), updatedAt: now() } : p
        ),
      }));
    },
    [setData]
  );

  /** Restore a soft-deleted property */
  const restaurerBien = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) => {
          if (p.id !== id) return p;
          const { deletedAt: _, ...rest } = p;
          return { ...rest, updatedAt: now() } as Bien;
        }),
      }));
    },
    [setData]
  );

  /** Permanently delete: removes property and all related entities */
  const supprimerDefinitivementBien = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.filter((p) => p.id !== id),
        expenses: prev.expenses.filter((e) => e.propertyId !== id),
        incomes: prev.incomes.filter((i) => i.propertyId !== id),
        loans: prev.loans.filter((l) => l.propertyId !== id),
        interventions: (prev.interventions ?? []).filter((i) => i.propertyId !== id),
        contacts: (prev.contacts ?? []).filter((c) => c.propertyId !== id),
        documents: (prev.documents ?? []).filter((d) => d.propertyId !== id),
        lots: (prev.lots ?? []).filter((l) => l.propertyId !== id),
      }));
    },
    [setData]
  );

  const obtenirBien = useCallback(
    (id: string) => properties.find((p) => p.id === id),
    [properties]
  );

  return {
    properties,
    biensSupprimes,
    ajouterBien,
    mettreAJourBien,
    supprimerBien,
    restaurerBien,
    supprimerDefinitivementBien,
    obtenirBien,
  };
}
