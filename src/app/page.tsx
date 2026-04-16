"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useDonnees } from "@/hooks/useLocalStorage";
import { useBiens } from "@/hooks/useBiens";
import { PropertyCard } from "@/components/dashboard/PropertyCard";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

// PropertyMap pulls in leaflet (~3.9 MB) — lazy-load to keep dashboard cold-load light.
const PropertyMap = dynamic(
  () => import("@/components/dashboard/PropertyMap").then((m) => m.PropertyMap),
  { ssr: false, loading: () => <div className="h-[300px] border border-dashed rounded-md" /> }
);

export default function Dashboard() {
  const { data, setData } = useDonnees();
  // useBiens returns the soft-delete-filtered list, so deleted cards
  // disappear from the dashboard immediately after the user confirms a delete.
  const { properties, supprimerBien } = useBiens(data, setData);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nom: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  if (!data) return null;

  const { settings } = data;

  const handleDeleteRequest = (id: string) => {
    const prop = properties.find((p) => p.id === id);
    if (prop) {
      setDeleteTarget({ id: prop.id, nom: prop.nom });
      setDeleteConfirm("");
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget && deleteConfirm === deleteTarget.nom) {
      supprimerBien(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirm("");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1>{settings.nomSCI}</h1>
          <Badge variant="outline">
            SC a l&apos;{settings.regimeFiscal}
          </Badge>
        </div>
        <Link href="/biens/nouveau">
          <Button>+ Nouveau bien</Button>
        </Link>
      </div>

      {/* Delete confirmation popup */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteTarget(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative border border-destructive/30 rounded-lg p-6 bg-background shadow-lg space-y-4 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-sm">Supprimer {deleteTarget.nom}</h3>
            <p className="text-sm text-muted-foreground">
              Toutes les donnees associees seront supprimees : depenses, revenus, credit, lots, interventions, contacts et documents.
            </p>
            <p className="text-sm text-muted-foreground">
              Tapez <strong className="text-foreground">{deleteTarget.nom}</strong> pour confirmer :
            </p>
            <Input
              autoFocus
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget.nom}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeleteConfirm(); if (e.key === "Escape") setDeleteTarget(null); }}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setDeleteTarget(null)}>Annuler</Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={deleteConfirm !== deleteTarget.nom}
                onClick={handleDeleteConfirm}
              >
                Supprimer definitivement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      {properties.length > 0 && (
        <PropertyMap properties={properties} />
      )}

      {/* KPIs */}
      {properties.length > 0 && (
        <>
          <PortfolioSummary data={data} />
          <Separator className="border-dashed" />
        </>
      )}

      {/* Liste des biens */}
      {properties.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-md">
          <p className="text-muted-foreground mb-4">Aucun bien immobilier enregistre.</p>
          <Link href="/biens/nouveau">
            <Button size="lg">Ajouter votre premier bien</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mes biens ({properties.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              expenses={data.expenses.filter((e) => e.propertyId === property.id)}
              incomes={data.incomes.filter((i) => i.propertyId === property.id)}
              rentEntries={(data.rentTracking ?? []).filter((e) => e.propertyId === property.id)}
              loan={data.loans.find((l) => l.propertyId === property.id) ?? null}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
        </div>
      )}
    </div>
  );
}
