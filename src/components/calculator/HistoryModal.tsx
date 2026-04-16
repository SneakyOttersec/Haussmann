"use client";

import type { SnapshotSimulation } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  simulationNom: string;
  history: SnapshotSimulation[];
  onClose: () => void;
  onRestore: (index: number) => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryModal({ open, simulationNom, history, onClose, onRestore }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative border border-dotted rounded-lg p-5 bg-background shadow-lg w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold">Historique — {simulationNom}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {history.length} version{history.length > 1 ? "s" : ""} precedente{history.length > 1 ? "s" : ""}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary text-lg leading-none"
          >
            ×
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            Aucune version anterieure. L&apos;historique est cree a chaque sauvegarde.
          </p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {history.map((snap, idx) => {
              const i = snap.inputs;
              const loyer = i.lots && i.lots.length > 0
                ? i.lots.reduce((s, l) => s + (l.loyerMensuel || 0), 0)
                : i.loyerMensuel;
              return (
                <div
                  key={idx}
                  className="border border-dotted rounded-md px-3 py-2 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{formatDateTime(snap.savedAt)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Prix {formatCurrency(i.prixAchat)} · Loyer {formatCurrency(loyer)}/mois
                      {i.montantTravaux > 0 && ` · Travaux ${formatCurrency(i.montantTravaux)}`}
                      {i.montantEmprunte > 0 && ` · Credit ${formatCurrency(i.montantEmprunte)}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRestore(idx)}
                    className="text-[11px] shrink-0"
                  >
                    Restaurer
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end mt-4 shrink-0">
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
