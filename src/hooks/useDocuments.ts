"use client";

import { useCallback, useMemo } from "react";
import type { DonneesApp, DocumentBien } from "@/types";
import { generateId } from "@/lib/utils";

export function useDocuments(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void,
  bienId?: string
) {
  const all = data?.documents ?? [];
  const documents = useMemo(
    () => bienId ? all.filter((d) => d.bienId === bienId) : all,
    [all, bienId]
  );

  const ajouterDocument = useCallback(
    (item: Omit<DocumentBien, "id">) => {
      setData((prev) => ({
        ...prev,
        documents: [...(prev.documents ?? []), { ...item, id: generateId() }],
      }));
    },
    [setData]
  );

  const supprimerDocument = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, documents: (prev.documents ?? []).filter((d) => d.id !== id) }));
    },
    [setData]
  );

  return { documents, ajouterDocument, supprimerDocument };
}
