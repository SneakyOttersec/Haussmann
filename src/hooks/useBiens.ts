"use client";

import { useCallback } from "react";
import type { DonneesApp, Bien } from "@/types";
import { generateId, now } from "@/lib/utils";

export function useBiens(
  data: DonneesApp | null,
  setData: (updater: (prev: DonneesApp) => DonneesApp) => void
) {
  const tousLesBiens = data?.biens ?? [];
  const biens = tousLesBiens.filter((p) => !p.deletedAt);
  const biensSupprimes = tousLesBiens.filter((p) => p.deletedAt);

  const ajouterBien = useCallback(
    (bien: Omit<Bien, "id" | "createdAt" | "updatedAt">) => {
      const nouveauBien: Bien = {
        ...bien,
        id: generateId(),
        createdAt: now(),
        updatedAt: now(),
      };
      setData((prev) => ({
        ...prev,
        biens: [...prev.biens, nouveauBien],
      }));
      return nouveauBien.id;
    },
    [setData]
  );

  const mettreAJourBien = useCallback(
    (id: string, updates: Partial<Omit<Bien, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        biens: prev.biens.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: now() } : p
        ),
      }));
    },
    [setData]
  );

  /** Soft-delete: marks the bien as deleted without removing data */
  const supprimerBien = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        biens: prev.biens.map((p) =>
          p.id === id ? { ...p, deletedAt: now(), updatedAt: now() } : p
        ),
      }));
    },
    [setData]
  );

  /** Restore a soft-deleted bien */
  const restaurerBien = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        biens: prev.biens.map((p) => {
          if (p.id !== id) return p;
          const { deletedAt: _, ...rest } = p;
          return { ...rest, updatedAt: now() } as Bien;
        }),
      }));
    },
    [setData]
  );

  /** Permanently delete: removes bien and all related entities */
  const supprimerDefinitivementBien = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        biens: prev.biens.filter((p) => p.id !== id),
        depenses: prev.depenses.filter((e) => e.bienId !== id),
        revenus: prev.revenus.filter((i) => i.bienId !== id),
        prets: prev.prets.filter((l) => l.bienId !== id),
        interventions: (prev.interventions ?? []).filter((i) => i.bienId !== id),
        contacts: (prev.contacts ?? []).filter((c) => c.bienId !== id),
        documents: (prev.documents ?? []).filter((d) => d.bienId !== id),
        lots: (prev.lots ?? []).filter((l) => l.bienId !== id),
      }));
    },
    [setData]
  );

  const obtenirBien = useCallback(
    (id: string) => biens.find((p) => p.id === id),
    [biens]
  );

  return {
    biens,
    biensSupprimes,
    ajouterBien,
    mettreAJourBien,
    supprimerBien,
    restaurerBien,
    supprimerDefinitivementBien,
    obtenirBien,
  };
}
