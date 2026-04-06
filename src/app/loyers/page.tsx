"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppData } from "@/hooks/useLocalStorage";
import { useRentTracking } from "@/hooks/useRentTracking";
import { useChargePayments } from "@/hooks/useChargePayments";
import { useLots } from "@/hooks/useLots";
import { useExpenses } from "@/hooks/useExpenses";
import { RentTrackingGrid } from "@/components/property/RentTrackingGrid";
import { ChargeTrackingGrid } from "@/components/property/ChargeTrackingGrid";
import { formatCurrency } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
import { PROPERTY_TYPE_LABELS } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROPERTY_STATUS_ORDER, PROPERTY_STATUS_LABELS } from "@/types";
import type { Lot, RentMonthEntry, Property, Expense, ChargePaymentEntry, PropertyStatus } from "@/types";

/** Returns true if the property has reached at least "acte signe" status. */
function isExploitable(statut?: PropertyStatus): boolean {
  if (!statut) return false;
  const idx = PROPERTY_STATUS_ORDER.indexOf(statut);
  const acteIdx = PROPERTY_STATUS_ORDER.indexOf("acte");
  return idx >= acteIdx;
}

/* ── Shared helpers ── */

function monthsWindow(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function computeRentKpis(lots: Lot[], entries: RentMonthEntry[], months: string[]) {
  const currentYM = currentMonthStr();
  const pastMonths = months.filter((m) => m <= currentYM);
  const windowEntries = entries.filter((e) => pastMonths.includes(e.yearMonth));
  const totalAttendu = lots.reduce((s, l) => s + l.loyerMensuel, 0) * pastMonths.length;
  const totalPercu = windowEntries.reduce((s, e) => s + e.loyerPercu, 0);
  const totalImpayes = windowEntries
    .filter((e) => e.statut === "impaye" || e.statut === "partiel")
    .reduce((s, e) => s + Math.max(0, e.loyerAttendu - e.loyerPercu), 0);
  const moisVacants = windowEntries.filter((e) => e.statut === "vacant" || e.statut === "travaux").length;
  const totalMoisLots = lots.length * pastMonths.length;
  const tauxOccupation = totalMoisLots > 0
    ? ((totalMoisLots - moisVacants) / totalMoisLots) * 100
    : 0;
  return { totalAttendu, totalPercu, totalImpayes, tauxOccupation };
}

/* ── Tab type ── */

type TabId = "loyers" | "charges";

/* ── Rent card (for property cards view) ── */

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
  const exploitable = isExploitable(property.statut);
  const kpis = useMemo(() => computeRentKpis(lots, entries, monthsWindow(12)), [lots, entries]);
  const loyerTheoriqueMensuel = lots.reduce((s, l) => s + l.loyerMensuel, 0);

  return (
    <Card
      className={`border-dotted transition-colors ${
        exploitable ? "hover:border-primary/50 cursor-pointer" : "opacity-60"
      }`}
      onClick={exploitable ? onClick : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-sm">{property.nom}</h3>
          <div className="flex items-center gap-1.5">
            {!exploitable && property.statut && (
              <Badge variant="outline" className="text-[10px]">{PROPERTY_STATUS_LABELS[property.statut]}</Badge>
            )}
            <Badge variant="secondary" className="text-xs">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3 truncate">
          {property.adresse} · {lots.length} lot{lots.length > 1 ? "s" : ""} · {formatCurrency(loyerTheoriqueMensuel)}/mois
        </p>
        {exploitable ? (
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
        ) : (
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Occupation</p>
              <p className="font-bold text-muted-foreground/40">N/A</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Percu 12m</p>
              <p className="font-bold text-muted-foreground/40">N/A</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Attendu 12m</p>
              <p className="font-bold text-muted-foreground/40">N/A</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Impayes</p>
              <p className="font-bold text-muted-foreground/40">N/A</p>
            </div>
          </div>
        )}
        {!exploitable && (
          <p className="text-[10px] text-muted-foreground italic mt-2">
            Suivi disponible a partir du statut &quot;Acte signe&quot;.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main content ── */

function LoyersContent() {
  const { data, setData } = useAppData();
  const { lots: allLots } = useLots(data, setData);
  const { expenses: allExpenses } = useExpenses(data, setData);
  const { entries: allRentEntries, upsertEntry: upsertRent, deleteEntry: deleteRent } = useRentTracking(data, setData);
  const { entries: allChargeEntries, upsertEntry: upsertCharge, deleteEntry: deleteCharge } = useChargePayments(data, setData);
  const searchParams = useSearchParams();
  const propertyIdFromUrl = searchParams.get("propertyId");
  const tabFromUrl = searchParams.get("tab") as TabId | null;

  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl === "charges" ? "charges" : "loyers");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  useEffect(() => {
    if (propertyIdFromUrl) setSelectedPropertyId(propertyIdFromUrl);
  }, [propertyIdFromUrl]);

  const propertiesWithData = useMemo(() => {
    if (!data) return [];
    return data.properties.map((p) => ({
      property: p,
      lots: allLots.filter((l) => l.propertyId === p.id),
      expenses: allExpenses.filter((e) => e.propertyId === p.id),
      exploitable: isExploitable(p.statut),
    }));
  }, [data, allLots, allExpenses]);

  // Global rent KPIs (exploitable properties only)
  const globalRentKpis = useMemo(() => {
    const months = monthsWindow(12);
    const allDisplayedLots = propertiesWithData.filter((x) => x.exploitable).flatMap((x) => x.lots);
    const kpis = computeRentKpis(allDisplayedLots, allRentEntries, months);
    return { ...kpis, totalLots: allDisplayedLots.length };
  }, [allRentEntries, propertiesWithData]);

  // Global charge KPIs (current year)
  const globalChargeKpis = useMemo(() => {
    const year = new Date().getFullYear();
    let totalAttendu = 0;
    let totalPaye = 0;
    let nbCharges = 0;

    for (const { expenses, exploitable } of propertiesWithData) {
      if (!exploitable) continue;
      for (const exp of expenses) {
        if (exp.frequence === "ponctuel" || exp.categorie === "credit") continue;
        nbCharges++;
        const montant = getCurrentMontant(exp);
        let periodsCount = 0;
        if (exp.frequence === "mensuel") periodsCount = 12;
        else if (exp.frequence === "trimestriel") periodsCount = 4;
        else if (exp.frequence === "annuel") periodsCount = 1;

        totalAttendu += montant * periodsCount;

        // Sum actually tracked payments
        const expEntries = allChargeEntries.filter(
          (e) => e.expenseId === exp.id && e.periode.startsWith(String(year)),
        );
        totalPaye += expEntries.reduce((s, e) => s + e.montantPaye, 0);
      }
    }

    const couverture = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;
    return { totalAttendu, totalPaye, ecart: totalAttendu - totalPaye, couverture, nbCharges };
  }, [propertiesWithData, allChargeEntries]);

  if (!data) return null;

  const selectedData = selectedPropertyId
    ? propertiesWithData.find((x) => x.property.id === selectedPropertyId)
    : null;
  // Only allow detail view for exploitable properties
  const selected = selectedData?.exploitable ? selectedData : null;

  const tabs: { id: TabId; label: string }[] = [
    { id: "loyers", label: "Loyers" },
    { id: "charges", label: "Charges" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1>Suivi des loyers & charges</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique mois par mois : loyers percus, impayes, charges payees.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-dashed border-muted-foreground/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedPropertyId(null); }}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {data.properties.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 rounded-md p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun bien enregistre.
          </p>
        </div>
      ) : (
        <>
          {/* Global KPIs */}
          {!selected && activeTab === "loyers" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-dotted rounded-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Taux d&apos;occupation (12m)
                </p>
                <p className="text-xl font-bold">{globalRentKpis.tauxOccupation.toFixed(0)} %</p>
                <p className="text-[10px] text-muted-foreground">{globalRentKpis.totalLots} lot{globalRentKpis.totalLots > 1 ? "s" : ""}</p>
              </div>
              <div className="border border-dotted rounded-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Loyers percus (12m)
                </p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(globalRentKpis.totalPercu)}</p>
              </div>
              <div className="border border-dotted rounded-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Loyers attendus (12m)
                </p>
                <p className="text-xl font-bold text-muted-foreground">{formatCurrency(globalRentKpis.totalAttendu)}</p>
              </div>
              <div className="border border-dotted rounded-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Impayes cumules
                </p>
                <p className={`text-xl font-bold ${globalRentKpis.totalImpayes > 0 ? "text-destructive" : ""}`}>
                  {formatCurrency(globalRentKpis.totalImpayes)}
                </p>
              </div>
            </div>
          )}

          {!selected && activeTab === "charges" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-dotted rounded-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total attendu ({new Date().getFullYear()})
                </p>
                <p className="text-xl font-bold text-muted-foreground">{formatCurrency(globalChargeKpis.totalAttendu)}</p>
                <p className="text-[10px] text-muted-foreground">{globalChargeKpis.nbCharges} charge{globalChargeKpis.nbCharges > 1 ? "s" : ""}</p>
              </div>
              <div className="border border-dotted rounded-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total paye ({new Date().getFullYear()})
                </p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(globalChargeKpis.totalPaye)}</p>
              </div>
              <div className="border border-dotted rounded-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Restant a payer
                </p>
                <p className={`text-xl font-bold ${globalChargeKpis.ecart > 0 ? "text-destructive" : ""}`}>
                  {formatCurrency(globalChargeKpis.ecart)}
                </p>
              </div>
              <div className="border border-dotted rounded-md p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Couverture
                </p>
                <p className="text-xl font-bold">{globalChargeKpis.couverture.toFixed(0)} %</p>
              </div>
            </div>
          )}

          {/* Property detail OR cards */}
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

              {activeTab === "loyers" ? (
                <RentTrackingGrid
                  propertyId={selected.property.id}
                  lots={selected.lots}
                  entries={allRentEntries.filter((e) => e.propertyId === selected.property.id)}
                  dateExploitation={selected.property.dateAchat}
                  onUpsert={upsertRent}
                  onDelete={deleteRent}
                />
              ) : (
                <ChargeTrackingGrid
                  propertyId={selected.property.id}
                  expenses={selected.expenses}
                  entries={allChargeEntries.filter((e) => e.propertyId === selected.property.id)}
                  onUpsert={upsertCharge}
                  onDelete={deleteCharge}
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {propertiesWithData.map(({ property, lots }) => (
                <PropertyRentCard
                  key={property.id}
                  property={property}
                  lots={lots}
                  entries={allRentEntries.filter((e) => e.propertyId === property.id)}
                  onClick={() => isExploitable(property.statut) ? setSelectedPropertyId(property.id) : undefined}
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
