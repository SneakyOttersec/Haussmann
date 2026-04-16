"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, Contact } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useContacts(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  propertyId?: string
) {
  const all = data?.contacts ?? [];
  const contacts = useMemo(
    () => propertyId ? all.filter((c) => c.propertyId === propertyId || !c.propertyId) : all,
    [all, propertyId]
  );

  const addContact = useCallback(
    (item: Omit<Contact, "id" | "createdAt" | "updatedAt">) => {
      setData((prev) => ({
        ...prev,
        contacts: [...(prev.contacts ?? []), { ...item, id: generateId(), createdAt: now(), updatedAt: now() }],
      }));
    },
    [setData]
  );

  const updateContact = useCallback(
    (id: string, updates: Partial<Contact>) => {
      setData((prev) => ({
        ...prev,
        contacts: (prev.contacts ?? []).map((c) => (c.id === id ? { ...c, ...updates, updatedAt: now() } : c)),
      }));
    },
    [setData]
  );

  const deleteContact = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, contacts: (prev.contacts ?? []).filter((c) => c.id !== id) }));
    },
    [setData]
  );

  return { contacts, addContact, updateContact, deleteContact };
}
