"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppData } from "@/hooks/useLocalStorage";
import { useRentTracking } from "@/hooks/useRentTracking";
import { useLots } from "@/hooks/useLots";
import { RentTrackingGrid } from "@/components/property/RentTrackingGrid";
import { formatCurrency } from "@/lib/utils";
import { PROPERTY_TYPE_LABELS } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Lot, RentMonthEntry, Property } from "@/types";

function monthsWindow(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${yyyy}-${mm}`);
  }
  return months;
}

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function computeKpis(lots: Lot[], entries: RentMonthEntry[], months: string[]) {
  // Exclude strictly-future months — only count months up to current month
  const currentYM = currentMonthStr();
  const pastMonths = months.filter((m) => m <= currentYM);
  const windowEntries = entries.filter((e) => pastMonths.includes(e.yearMonth));
  const totalAttendu = lots.reduce((s, l) => s + l.loyerMensuel, 0) * pastMonths.length;
  const totalPercu = windowEntries.reduce((s, e) => s + e.loyerPercu, 0);
  const totalImpayes = windowEntries
    .filter((e) => e.statut === "impaye" || e.statut === "partiel")
    .reduce((s, e) => s + Math.max(0, e.loyerAttendu - e.loyerPercu), 0);
  const moisVacants = windowEntries.filter((e) => e.statut === "vacant").length;
  const totalMoisLots = lots.length * pastMonths.length;
  const tauxOccupation = totalMoisLots > 0
    ? ((totalMoisLots - moisVacants) / totalMoisLots) * 100
    : 0;
  return { totalAttendu, totalPercu, totalImpayes, tauxOccupation };
}

function PropertyRentCard({
  property,
  lots,
  entries,
  onClick,
}: {
  property: Property;
  lots: Lot[];
  entries: RentMonthEntry[];
  onClick: () => void;
}) {
  const kpis = useMemo(() => computeKpis(lots, entries, monthsWindow(12)), [lots, entries]);
  const loyerTheoriqueMensuel = lots.reduce((s, l) => s + l.loyerMensuel, 0);

  return (
    <Card
      className="border-dotted hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-sm">{property.nom}</h3>
          <Badge variant="secondary" className="text-xs">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3 truncate">
          {property.adresse} · {lots.length} lot{lots.length > 1 ? "s" : ""} · {formatCurrency(loyerTheoriqueMensuel)}/mois
        </p>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Occupation</p>
            <p className="font-bold">{kpis.tauxOccupation.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Percu 12m</p>
            <p className="font-bold text-green-600">{formatCurrency(kpis.totalPercu)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Attendu 12m</p>
            <p className="font-bold text-muted-foreground">{formatCurrency(kpis.totalAttendu)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Impayes</p>
            <p className={`font-bold ${kpis.totalImpayes > 0 ? "text-destructive" : ""}`}>
              {formatCurrency(kpis.totalImpayes)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoyersContent() {
  const { data, setData } = useAppData();
  const { lots: allLots } = useLots(data, setData);
  const {
    entries: allEntries,
    upsertEntry,
    deleteEntry,
  } = useRentTracking(data, setData);
  const searchParams = useSearchParams();
  const propertyIdFromUrl = searchParams.get("propertyId");

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  // Pre-select a property if passed via URL (e.g. ?propertyId=xxx from another page)
  useEffect(() => {
    if (propertyIdFromUrl) {
      setSelectedPropertyId(propertyIdFromUrl);
    }
  }, [propertyIdFromUrl]);

  const propertiesWithLots = useMemo(() => {
    if (!data) return [];
    return data.properties
      .map((p) => ({
        property: p,
        lots: allLots.filter((l) => l.propertyId === p.id),
      }))
      .filter((x) => x.lots.length > 0);
  }, [data, allLots]);

  // Global KPIs over last 12 months across all properties
  const globalKpis = useMemo(() => {
    const months = monthsWindow(12);
    const allDisplayedLots = propertiesWithLots.flatMap((x) => x.lots);
    const kpis = computeKpis(allDisplayedLots, allEntries, months);
    return { ...kpis, totalLots: allDisplayedLots.length };
  }, [allEntries, propertiesWithLots]);

  if (!data) return null;

  const selected = selectedPropertyId
    ? propertiesWithLots.find((x) => x.property.id === selectedPropertyId)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1>Suivi des loyers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique mois par mois : loyers percus, impayes, vacance locative.
        </p>
      </div>

      {propertiesWithLots.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 rounded-md p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun lot a suivre. Ajoute des lots sur tes biens pour commencer le suivi.
          </p>
        </div>
      ) : (
        <>
          {/* Global KPIs (always visible) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-dotted rounded-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Taux d&apos;occupation (12m)
              </p>
              <p className="text-xl font-bold">{globalKpis.tauxOccupation.toFixed(0)} %</p>
              <p className="text-[10px] text-muted-foreground">{globalKpis.totalLots} lot{globalKpis.totalLots > 1 ? "s" : ""}</p>
            </div>
            <div className="border border-dotted rounded-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Loyers percus (12m)
              </p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(globalKpis.totalPercu)}</p>
            </div>
            <div className="border border-dotted rounded-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Loyers attendus (12m)
              </p>
              <p className="text-xl font-bold text-muted-foreground">{formatCurrency(globalKpis.totalAttendu)}</p>
            </div>
            <div className="border border-dotted rounded-md p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Impayes cumules
              </p>
              <p className={`text-xl font-bold ${globalKpis.totalImpayes > 0 ? "text-destructive" : ""}`}>
                {formatCurrency(globalKpis.totalImpayes)}
              </p>
            </div>
          </div>

          {/* Cards view OR single property detail */}
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedPropertyId(null)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  ← Tous les biens
                </button>
                <Link
                  href={`/biens?id=${selected.property.id}`}
                  className="text-[11px] text-muted-foreground hover:text-primary"
                >
                  Voir la fiche bien →
                </Link>
              </div>
              <div>
                <h2 className="text-lg font-semibold">{selected.property.nom}</h2>
                <p className="text-xs text-muted-foreground">{selected.property.adresse}</p>
              </div>
              <RentTrackingGrid
                propertyId={selected.property.id}
                lots={selected.lots}
                entries={allEntries.filter((e) => e.propertyId === selected.property.id)}
                onUpsert={upsertEntry}
                onDelete={deleteEntry}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {propertiesWithLots.map(({ property, lots }) => (
                <PropertyRentCard
                  key={property.id}
                  property={property}
                  lots={lots}
                  entries={allEntries.filter((e) => e.propertyId === property.id)}
                  onClick={() => setSelectedPropertyId(property.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LoyersPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <LoyersContent />
    </Suspense>
  );
}
