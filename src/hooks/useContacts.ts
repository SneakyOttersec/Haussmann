"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Contact } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useContacts(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  bienId?: string
) {
  const all = data?.contacts ?? [];
  const contacts = useMemo(
    () => bienId ? all.filter((c) => c.bienId === bienId || !c.bienId) : all,
    [all, bienId]
  );

  const ajouterContact = useCallback(
    (item: Omit<Contact, "id" | "createdAt" | "updatedAt">) => {
      setData((prev) => ({
        ...prev,
        contacts: [...(prev.contacts ?? []), { ...item, id: generateId(), createdAt: now(), updatedAt: now() }],
      }));
    },
    [setData]
  );

  const mettreAJourContact = useCallback(
    (id: string, updates: Partial<Contact>) => {
      setData((prev) => ({
        ...prev,
        contacts: (prev.contacts ?? []).map((c) => (c.id === id ? { ...c, ...updates, updatedAt: now() } : c)),
      }));
    },
    [setData]
  );

  const supprimerContact = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, contacts: (prev.contacts ?? []).filter((c) => c.id !== id) }));
    },
    [setData]
  );

  return { contacts, ajouterContact, mettreAJourContact, supprimerContact };
}
