"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, DocumentBien } from "@/types";
import { generateId } from "@/lib/utils";

export function useDocuments(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  propertyId?: string
) {
  const all = data?.documents ?? [];
  const documents = useMemo(
    () => propertyId ? all.filter((d) => d.propertyId === propertyId) : all,
    [all, propertyId]
  );

  const addDocument = useCallback(
    (item: Omit<DocumentBien, "id">) => {
      setData((prev) => ({
        ...prev,
        documents: [...(prev.documents ?? []), { ...item, id: generateId() }],
      }));
    },
    [setData]
  );

  const deleteDocument = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, documents: (prev.documents ?? []).filter((d) => d.id !== id) }));
    },
    [setData]
  );

  return { documents, addDocument, deleteDocument };
}
