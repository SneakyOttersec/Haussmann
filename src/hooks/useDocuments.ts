"use client";

import { useCallback, useMemo } from "react";
import type { AppData, PropertyDocument } from "@/types";
import { generateId } from "@/lib/utils";

export function useDocuments(
  data: AppData | null,
  setData: (updater: (prev: AppData) => AppData) => void,
  propertyId?: string
) {
  const all = data?.documents ?? [];
  const documents = useMemo(
    () => propertyId ? all.filter((d) => d.propertyId === propertyId) : all,
    [all, propertyId]
  );

  const addDocument = useCallback(
    (item: Omit<PropertyDocument, "id">) => {
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
