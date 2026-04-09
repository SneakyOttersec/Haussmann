"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppData } from "@/hooks/useLocalStorage";
import { useProperties } from "@/hooks/useProperties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Corbeille() {
  const { data, setData } = useAppData();
  const { deletedProperties, restoreProperty, permanentlyDeleteProperty } = useProperties(data, setData);

  // Two-step confirmation for permanent deletion: the user must type the property name.
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; nom: string } | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");

  if (!data) return null;

  const confirmPurge = () => {
    if (purgeTarget && purgeConfirm === purgeTarget.nom) {
      permanentlyDeleteProperty(purgeTarget.id);
      setPurgeTarget(null);
      setPurgeConfirm("");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1>Corbeille</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Biens supprimes — vous pouvez les restaurer ou les supprimer definitivement.
          La suppression definitive efface aussi toutes les donnees liees (depenses, revenus,
          credit, lots, interventions, contacts, documents).
        </p>
      </div>

      {deletedProperties.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 rounded-md p-8 text-center">
          <p className="text-sm text-muted-foreground">La corbeille est vide.</p>
          <Link href="/" className="text-primary text-sm hover:underline mt-2 inline-block">
            Retour au portefeuille
          </Link>
        </div>
      ) : (
        <section className="border border-dotted rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider">
            {deletedProperties.length} bien{deletedProperties.length > 1 ? "s" : ""}
          </h2>
          <div className="space-y-2">
            {deletedProperties.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 border-b border-dotted last:border-0"
              >
                <div>
                  <span className="text-sm font-medium">{p.nom}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    Supprime le {new Date(p.deletedAt!).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => restoreProperty(p.id)}>
                    Restaurer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      setPurgeTarget({ id: p.id, nom: p.nom });
                      setPurgeConfirm("");
                    }}
                  >
                    Supprimer definitivement
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Purge confirmation */}
      {purgeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setPurgeTarget(null)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative border border-destructive/30 rounded-lg p-6 bg-background shadow-lg space-y-4 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-sm">Supprimer definitivement {purgeTarget.nom}</h3>
            <p className="text-sm text-muted-foreground">
              Cette action est irreversible. Toutes les donnees liees seront effacees.
            </p>
            <p className="text-sm text-muted-foreground">
              Tapez <strong className="text-foreground">{purgeTarget.nom}</strong> pour confirmer :
            </p>
            <Input
              autoFocus
              value={purgeConfirm}
              onChange={(e) => setPurgeConfirm(e.target.value)}
              placeholder={purgeTarget.nom}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmPurge();
                if (e.key === "Escape") setPurgeTarget(null);
              }}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPurgeTarget(null)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={purgeConfirm !== purgeTarget.nom}
                onClick={confirmPurge}
              >
                Supprimer definitivement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
