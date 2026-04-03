"use client";

import { useCallback } from "react";
import type { AppData, Property } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useProperties(
  data: AppData | null,
  setData: (updater: (prev: AppData) => AppData) => void
) {
  const properties = data?.properties ?? [];

  const addProperty = useCallback(
    (property: Omit<Property, "id" | "createdAt" | "updatedAt">) => {
      const newProperty: Property = {
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

  const updateProperty = useCallback(
    (id: string, updates: Partial<Omit<Property, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: now() } : p
        ),
      }));
    },
    [setData]
  );

  const deleteProperty = useCallback(
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

  const getProperty = useCallback(
    (id: string) => properties.find((p) => p.id === id),
    [properties]
  );

  return { properties, addProperty, updateProperty, deleteProperty, getProperty };
}
