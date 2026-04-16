"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useDonnees } from "@/hooks/useLocalStorage";
import type { DonneesApp, Bien, StatutBien } from "@/types";
import { computeBilanFiscal, getAvailableYears } from "@/lib/calculs/bilanFiscal";
import { toast } from "sonner";
import { formatCurrency, mensualiserMontant, annualiserMontant, coutTotalBien, getPropertyAcquisitionDate } from "@/lib/utils";
import { obtenirMontantEffectif, obtenirMontantCourant } from "@/lib/revisionsDepenses";
import { crdAuMois, dureeTotaleMoisPret } from "@/lib/calculs/pret";
import { Card, CardContent } from "@/components/ui/card";
import type { MonthlyFinance, PatrimoineMonth, RendementMonth } from "@/components/finances/FinancesCharts";

// recharts (~8.5 MB) lives only inside FinancesCharts — lazy-load to keep /finances cold-load light.
const CashFlowChartFinances = dynamic(
  () => import("@/components/finances/FinancesCharts").then((m) => m.CashFlowChartFinances),
  { ssr: false, loading: () => <div className="h-[300px] border border-dotted rounded-md" /> }
);
const PatrimoineChart = dynamic(
  () => import("@/components/finances/FinancesCharts").then((m) => m.PatrimoineChart),
  { ssr: false, loading: () => <div className="h-[250px] border border-dotted rounded-md" /> }
);
const RendementChartFinances = dynamic(
  () => import("@/components/finances/FinancesCharts").then((m) => m.RendementChartFinances),
  { ssr: false, loading: () => <div className="h-[320px] border border-dotted rounded-md" /> }
);

/** Hard cap so charts stay snappy even when a property has very old prospection dates. */
const MAX_HISTORY_MONTHS = 60;

function buildMonthlyCashFlow(data: DonneesApp): MonthlyFinance[] {
  const now = new Date();
  const months: MonthlyFinance[] = [];
  let cumul = 0;

  // Determine start month: earliest known date across all properties, capped to MAX_HISTORY_MONTHS back.
  const allDates = data.properties.map((p) => earliestDate(p));
  const minCap = new Date(now.getFullYear(), now.getMonth() - MAX_HISTORY_MONTHS, 1);
  const earliestRaw = allDates.length > 0
    ? allDates.reduce((min, d) => (d < min ? d : min))
    : new Date(now.getFullYear(), now.getMonth() - 23, 1);
  const earliest = earliestRaw > minCap ? earliestRaw : minCap;
  const startMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1);

  // Build range from startMonth to current month (inclusive)
  const totalMonths = (now.getFullYear() - startMonth.getFullYear()) * 12
    + (now.getMonth() - startMonth.getMonth()) + 1;

  // Pre-index rent tracking entries by YYYY-MM for fast lookup
  const rentByYM = new Map<string, number>();
  for (const e of (data.rentTracking ?? [])) {
    rentByYM.set(e.yearMonth, (rentByYM.get(e.yearMonth) ?? 0) + e.loyerPercu);
  }

  // Pre-index charge payments by YYYY-MM
  // Trimestriel "YYYY-Q1" → spread across 3 months, Annuel "YYYY" → spread across 12
  const chargeByYM = new Map<string, number>();
  for (const cp of (data.chargePayments ?? [])) {
    if (cp.montantPaye <= 0) continue;
    if (cp.periode.includes("-Q")) {
      // Quarterly: "2025-Q1" → jan, feb, mar
      const [y, q] = cp.periode.split("-Q");
      const startM = (Number(q) - 1) * 3 + 1;
      for (let m = startM; m < startM + 3; m++) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        chargeByYM.set(key, (chargeByYM.get(key) ?? 0) + cp.montantPaye / 3);
      }
    } else if (cp.periode.length === 4) {
      // Annual: "2025" → spread across 12 months
      for (let m = 1; m <= 12; m++) {
        const key = `${cp.periode}-${String(m).padStart(2, "0")}`;
        chargeByYM.set(key, (chargeByYM.get(key) ?? 0) + cp.montantPaye / 12);
      }
    } else {
      // Monthly: "2025-03"
      chargeByYM.set(cp.periode, (chargeByYM.get(cp.periode) ?? 0) + cp.montantPaye);
    }
  }

  // Track which expenses have real payment data
  const expensesWithPayments = new Set((data.chargePayments ?? []).map(cp => cp.expenseId));

  for (let i = totalMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    let revenus = 0, depenses = 0, credit = 0;

    // Revenus: use rent tracking (actual) for loyers, incomes for other revenue
    revenus += rentByYM.get(ym) ?? 0;

    for (const inc of data.incomes) {
      if (inc.categorie === "loyer") continue;
      const start = new Date(inc.dateDebut);
      const end = inc.dateFin ? new Date(inc.dateFin) : null;
      if (start > monthEnd || (end && end < d)) continue;
      if (inc.frequence === "ponctuel") {
        if (start.getFullYear() === d.getFullYear() && start.getMonth() === d.getMonth()) revenus += inc.montant;
      } else {
        revenus += mensualiserMontant(inc.montant, inc.frequence);
      }
    }

    // Depenses: use charge payments (actual) when available, fallback to projection
    // Add real charge payments for this month
    depenses += chargeByYM.get(ym) ?? 0;

    for (const exp of data.expenses) {
      if (expensesWithPayments.has(exp.id)) continue; // already counted via chargePayments
      const start = new Date(exp.dateDebut);
      const end = exp.dateFin ? new Date(exp.dateFin) : null;
      if (start > monthEnd || (end && end < d)) continue;
      const montantEff = obtenirMontantEffectif(exp, d);
      let m = 0;
      if (exp.frequence === "ponctuel") {
        if (start.getFullYear() === d.getFullYear() && start.getMonth() === d.getMonth()) m = montantEff;
      } else {
        m = mensualiserMontant(montantEff, exp.frequence);
      }
      if (exp.categorie === "credit") credit += m; else depenses += m;
    }

    const cf = Math.round(revenus - depenses - credit);
    cumul += cf;
    months.push({ mois: label, revenus: Math.round(revenus), depenses: Math.round(depenses), credit: Math.round(credit), cashFlow: cf, cumulCashFlow: cumul });
  }
  return months;
}

const APPRECIATION_ANNUELLE = 0.02;

function buildPatrimoine(data: DonneesApp, projectionYears: number): PatrimoineMonth[] {
  const months: PatrimoineMonth[] = [];
  const now = new Date();

  // Start: earliest known date across all properties, capped to MAX_HISTORY_MONTHS back.
  const allDates = data.properties.map((p) => earliestDate(p));
  if (allDates.length === 0) return months;

  const minCap = new Date(now.getFullYear(), now.getMonth() - MAX_HISTORY_MONTHS, 1);
  const earliestRaw = allDates.reduce((min, d) => (d < min ? d : min));
  const earliest = earliestRaw > minCap ? earliestRaw : minCap;
  const startMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  // End: current month + projectionYears years
  const endMonth = new Date(now.getFullYear(), now.getMonth() + projectionYears * 12, 1);

  const totalMonths = (endMonth.getFullYear() - startMonth.getFullYear()) * 12
    + (endMonth.getMonth() - startMonth.getMonth()) + 1;

  for (let i = 0; i < totalMonths; i++) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

    let totalValeur = 0, totalCRD = 0;

    for (const p of data.properties) {
      const achat = new Date(getPropertyAcquisitionDate(p));
      if (isNaN(achat.getTime())) continue;
      // Compare at month granularity — include the acquisition month itself
      const achatMonth = new Date(achat.getFullYear(), achat.getMonth(), 1);
      if (achatMonth > d) continue;
      const valeurInitiale = p.prixAchat + p.montantTravaux;
      const yearsSinceAchat = Math.max(
        0,
        (d.getFullYear() - achat.getFullYear()) + (d.getMonth() - achat.getMonth()) / 12,
      );
      totalValeur += valeurInitiale * Math.pow(1 + APPRECIATION_ANNUELLE, yearsSinceAchat);
    }

    for (const loan of data.loans) {
      const loanStart = new Date(loan.dateDebut);
      if (isNaN(loanStart.getTime())) continue;
      const loanStartMonth = new Date(loanStart.getFullYear(), loanStart.getMonth(), 1);
      if (loanStartMonth > d) continue; // loan not yet started
      const monthsElapsed = (d.getFullYear() - loanStart.getFullYear()) * 12 + (d.getMonth() - loanStart.getMonth());
      const cappedMonth = Math.min(Math.max(0, monthsElapsed), dureeTotaleMoisPret(loan) - 1);
      // crdAuMois handles defer (partiel/total) correctly.
      totalCRD += crdAuMois(loan, cappedMonth);
    }

    months.push({ mois: label, valeurBiens: Math.round(totalValeur), capitalRestantDu: Math.round(totalCRD), patrimoineNet: Math.round(totalValeur - totalCRD) });
  }
  return months;
}

function earliestDate(p: Bien): Date {
  return new Date(getPropertyAcquisitionDate(p));
}

/** Statuts pre-acte: le bien n'est pas encore acquis, pas de flux financiers */
const PRE_ACTE_STATUSES: StatutBien[] = ['prospection', 'offre', 'compromis'];

function isPropertyActive(statut: StatutBien | undefined): boolean {
  if (!statut) return true; // backward compat: no status = assume active
  return !PRE_ACTE_STATUSES.includes(statut);
}

/** Filter DonneesApp to only include financially active properties (post-acte AND not soft-deleted) */
function filterActiveProperties(data: DonneesApp): DonneesApp {
  const activeIds = new Set(
    data.properties.filter((p) => !p.deletedAt && isPropertyActive(p.statut)).map((p) => p.id),
  );
  return {
    ...data,
    properties: data.properties.filter((p) => activeIds.has(p.id)),
    incomes: data.incomes.filter((i) => activeIds.has(i.propertyId)),
    expenses: data.expenses.filter((e) => activeIds.has(e.propertyId)),
    loans: data.loans.filter((l) => activeIds.has(l.propertyId)),
    lots: (data.lots ?? []).filter((l) => activeIds.has(l.propertyId)),
    rentTracking: (data.rentTracking ?? []).filter((r) => activeIds.has(r.propertyId)),
    chargePayments: (data.chargePayments ?? []).filter((c) => activeIds.has(c.propertyId)),
  };
}

export default function Finances() {
  const { data } = useDonnees();
  const [bilanYear, setBilanYear] = useState(new Date().getFullYear());
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null); // null = all
  const [projectionYears, setProjectionYears] = useState(10);

  // Build filtered data: exclude pre-acte properties, then apply user selection
  const activeData = useMemo(() => data ? filterActiveProperties(data) : null, [data]);

  const filteredData = useMemo(() => {
    if (!activeData) return null;
    if (selectedIds === null) return activeData;
    const propertyIds = selectedIds;
    return {
      ...activeData,
      properties: activeData.properties.filter((p) => propertyIds.has(p.id)),
      incomes: activeData.incomes.filter((i) => propertyIds.has(i.propertyId)),
      expenses: activeData.expenses.filter((e) => propertyIds.has(e.propertyId)),
      loans: activeData.loans.filter((l) => propertyIds.has(l.propertyId)),
      lots: (activeData.lots ?? []).filter((l) => propertyIds.has(l.propertyId)),
      rentTracking: (activeData.rentTracking ?? []).filter((r) => propertyIds.has(r.propertyId)),
      chargePayments: (activeData.chargePayments ?? []).filter((c) => propertyIds.has(c.propertyId)),
    };
  }, [activeData, selectedIds]);

  const cashFlowData = useMemo(() => filteredData ? buildMonthlyCashFlow(filteredData) : [], [filteredData]);
  const patrimoineData = useMemo(() => filteredData ? buildPatrimoine(filteredData, projectionYears) : [], [filteredData, projectionYears]);
  // Rendement mensuel = (revenus × 12) / coutTotal — fenetre glissante 12m
  // + cumul depuis le premier mois avec loyer percu.
  const rendementData = useMemo<RendementMonth[]>(() => {
    if (!filteredData) return [];
    const coutTotal = filteredData.properties
      .filter((p) => !p.deletedAt && isPropertyActive(p.statut))
      .reduce((s, p) => s + coutTotalBien(p), 0);
    if (coutTotal <= 0 || cashFlowData.length === 0) return [];
    // Trouve l'index du premier mois avec loyer percu > 0 pour demarrer
    // la courbe cumulative.
    const firstRentIdx = cashFlowData.findIndex((m) => m.revenus > 0);
    // Derniere ligne avec loyer percu (pour couper l'historique et eviter
    // la chute a droite).
    const lastRentIdx = cashFlowData.reduce(
      (acc, m, i) => (m.revenus > 0 ? i : acc),
      -1,
    );
    const effective = lastRentIdx >= 0 ? cashFlowData.slice(0, lastRentIdx + 1) : cashFlowData;
    return effective.map((m, i) => {
      // Rolling 12 mois
      const rollWin = effective.slice(Math.max(0, i - 11), i + 1);
      const rollRev = rollWin.reduce((s, x) => s + x.revenus, 0);
      const rollDep = rollWin.reduce((s, x) => s + x.depenses, 0);
      const rollFactor = 12 / rollWin.length;
      const rBrutRoll = ((rollRev * rollFactor) / coutTotal) * 100;
      const rNetRoll = (((rollRev - rollDep) * rollFactor) / coutTotal) * 100;
      // Cumul depuis premier loyer
      let rBrutCumul: number | null = null;
      let rNetCumul: number | null = null;
      if (firstRentIdx >= 0 && i >= firstRentIdx) {
        const cumulWin = effective.slice(firstRentIdx, i + 1);
        const cumulRev = cumulWin.reduce((s, x) => s + x.revenus, 0);
        const cumulDep = cumulWin.reduce((s, x) => s + x.depenses, 0);
        const cumulFactor = 12 / cumulWin.length;
        rBrutCumul = ((cumulRev * cumulFactor) / coutTotal) * 100;
        rNetCumul = (((cumulRev - cumulDep) * cumulFactor) / coutTotal) * 100;
      }
      return {
        mois: m.mois,
        rBrutRoll: Math.round(rBrutRoll * 100) / 100,
        rNetRoll: Math.round(rNetRoll * 100) / 100,
        rBrutCumul: rBrutCumul != null ? Math.round(rBrutCumul * 100) / 100 : null,
        rNetCumul: rNetCumul != null ? Math.round(rNetCumul * 100) / 100 : null,
      };
    });
  }, [filteredData, cashFlowData]);
  const bilan = useMemo(() => filteredData ? computeBilanFiscal(filteredData, bilanYear) : null, [filteredData, bilanYear]);
  const availableYears = useMemo(() => filteredData ? getAvailableYears(filteredData) : [], [filteredData]);

  // Group cashFlowData by year for the KPI cards (current + 3 previous years).
  // This useMemo MUST be before the early return to respect the Rules of Hooks.
  const cfByYear = useMemo(() => {
    const map = new Map<number, { revenus: number; depenses: number; credit: number; cashFlow: number; mois: number }>();
    for (const m of cashFlowData) {
      const parts = m.mois.split(" ");
      const yrShort = parseInt(parts[parts.length - 1]);
      const yr = yrShort < 100 ? 2000 + yrShort : yrShort;
      if (isNaN(yr)) continue;
      const prev = map.get(yr) ?? { revenus: 0, depenses: 0, credit: 0, cashFlow: 0, mois: 0 };
      prev.revenus += m.revenus;
      prev.depenses += m.depenses + m.credit;
      prev.cashFlow += m.cashFlow;
      prev.mois += 1;
      map.set(yr, prev);
    }
    return map;
  }, [cashFlowData]);

  if (!data || !filteredData) return null;

  const seuil = data.settings.seuilAlerteTresorerie ?? 0;
  const lastCumul = cashFlowData.length > 0 ? cashFlowData[cashFlowData.length - 1].cumulCashFlow : 0;
  const alertActive = seuil > 0 && lastCumul < seuil;

  const currentYear = new Date().getFullYear();
  const currentYearData = cfByYear.get(currentYear);
  const totalRevenus = currentYearData?.revenus ?? 0;
  const totalDepenses = currentYearData?.depenses ?? 0;
  const cashFlowAnnuel = currentYearData?.cashFlow ?? 0;

  // Previous years (up to 3), most recent first
  const previousYears = Array.from(cfByYear.keys())
    .filter((y) => y < currentYear)
    .sort((a, b) => b - a)
    .slice(0, 3);

  const activeProperties = activeData?.properties ?? [];
  const allIds = new Set(activeProperties.map((p) => p.id));
  const activeIds = selectedIds ?? allIds;
  const allSelected = selectedIds === null || selectedIds.size === activeProperties.length;

  const toggleProperty = (id: string) => {
    setSelectedIds((prev) => {
      // Start from the current effective selection (if null, that's "all")
      const current = prev ?? new Set(allIds);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Collapse to null when everyone is selected (keeps "Tous" visually active)
      if (next.size === activeProperties.length) return null;
      return next;
    });
  };

  const isolateProperty = (id: string) => {
    // Shortcut: select only this property
    setSelectedIds(new Set([id]));
  };

  const selectAll = () => {
    setSelectedIds(null);
  };

  return (
    <div className="space-y-6">
      <h1>Finances</h1>

      {/* Bien filter */}
      {activeProperties.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Biens :</span>
          <button
            onClick={selectAll}
            className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
              allSelected
                ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            Tous ({activeProperties.length})
          </button>
          {activeProperties.map((p) => {
            const active = activeIds.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleProperty(p.id)}
                onDoubleClick={() => isolateProperty(p.id)}
                title="Clic : ajouter/retirer · Double-clic : isoler"
                className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                    : "border-dotted border-muted-foreground/20 text-muted-foreground/40 hover:text-foreground hover:border-muted-foreground/40"
                }`}
              >
                {p.nom}
              </button>
            );
          })}
        </div>
      )}

      {filteredData.properties.length === 0 && (
        <div className="border border-dashed border-muted-foreground/30 rounded-md p-4 text-sm text-muted-foreground text-center">
          {activeProperties.length === 0
            ? "Aucun bien post-acte. Les biens en prospection, offre ou compromis ne sont pas inclus dans les finances."
            : "Aucun bien selectionne."}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-dotted"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Revenus {currentYear}</p>
          <p className="text-lg font-bold">{formatCurrency(totalRevenus)}</p>
          {previousYears.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-dashed border-muted-foreground/10 space-y-0.5">
              {previousYears.map((y) => (
                <div key={y} className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{y}</span>
                  <span className="tabular-nums">{formatCurrency(cfByYear.get(y)?.revenus ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
        <Card className="border-dotted"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Depenses {currentYear}</p>
          <p className="text-lg font-bold">{formatCurrency(totalDepenses)}</p>
          {previousYears.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-dashed border-muted-foreground/10 space-y-0.5">
              {previousYears.map((y) => (
                <div key={y} className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{y}</span>
                  <span className="tabular-nums">{formatCurrency(cfByYear.get(y)?.depenses ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
        <Card className="border-dotted"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Cash flow {currentYear}</p>
          <p className={`text-lg font-bold ${cashFlowAnnuel >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(cashFlowAnnuel)}</p>
          {previousYears.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-dashed border-muted-foreground/10 space-y-0.5">
              {previousYears.map((y) => {
                const cf = cfByYear.get(y)?.cashFlow ?? 0;
                return (
                  <div key={y} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{y}</span>
                    <span className={`tabular-nums ${cf >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(cf)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent></Card>
        <Card className="border-dotted"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Cash flow cumule</p>
          <p className={`text-lg font-bold ${lastCumul >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(lastCumul)}</p>
        </CardContent></Card>
      </div>

      {alertActive && (
        <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 text-sm text-destructive">
          Attention : tresorerie cumulee ({formatCurrency(lastCumul)}) inferieure au seuil d&apos;alerte ({formatCurrency(seuil)})
        </div>
      )}

      {/* Cash flow chart (lazy-loaded) */}
      <CashFlowChartFinances data={cashFlowData} seuil={seuil} />

      {/* Rendement chart (lazy-loaded) */}
      {rendementData.length > 0 && <RendementChartFinances data={rendementData} />}

      {/* Patrimoine chart (lazy-loaded) */}
      <PatrimoineChart data={patrimoineData} projectionYears={projectionYears} onProjectionChange={setProjectionYears} />

      {/* Bilan fiscal */}
      {bilan && bilan.rows.length > 0 && (
        <div className="border border-dotted rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bilan fiscal — SC a l&apos;{bilan.regime}</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {availableYears.map((y) => (
                  <button key={y} onClick={() => setBilanYear(y)}
                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${bilanYear === y ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted"}`}
                  >{y}</button>
                ))}
              </div>
              {data && (
                <button
                  onClick={async () => {
                    toast.info("Generation en cours...");
                    // Lazy-load the liasse module + jspdf only when the user actually clicks.
                    if (bilan.regime === "IR") {
                      const { generateLiasse2072 } = await import("@/lib/reports/liasse-2072");
                      await generateLiasse2072(data, bilanYear);
                      toast.success("Liasse 2072-S generee");
                    } else {
                      const { generateLiasseIS } = await import("@/lib/reports/liasse-is");
                      await generateLiasseIS(data, bilanYear);
                      toast.success("Liasse IS generee");
                    }
                  }}
                  className="px-2.5 py-0.5 text-[10px] rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-medium"
                >
                  {bilan.regime === "IR" ? "2072-S PDF" : "Liasse IS PDF"}
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-dashed border-muted-foreground/20">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Bien</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Revenus</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Charges</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Interets</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Assurance</th>
                  {bilan.regime === "IS" && <th className="text-right py-2 px-2 text-muted-foreground font-medium">Amort.</th>}
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Resultat</th>
                </tr>
              </thead>
              <tbody>
                {bilan.rows.map((r) => (
                  <tr key={r.propertyId} className="hover:bg-muted/20">
                    <td className="py-1.5 px-2 font-medium">{r.propertyNom}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(r.revenusLocatifs)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-destructive">{formatCurrency(-r.chargesDeductibles)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-destructive">{formatCurrency(-r.interetsEmprunt)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-destructive">{formatCurrency(-r.assuranceEmprunt)}</td>
                    {bilan.regime === "IS" && <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{formatCurrency(-r.amortissements)}</td>}
                    <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${r.resultatFiscal >= 0 ? "" : "text-destructive"}`}>{formatCurrency(r.resultatFiscal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-dashed border-muted-foreground/20 font-bold bg-muted/30">
                  <td className="py-2 px-2">{bilan.totaux.propertyNom}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(bilan.totaux.revenusLocatifs)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-destructive">{formatCurrency(-bilan.totaux.chargesDeductibles)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-destructive">{formatCurrency(-bilan.totaux.interetsEmprunt)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-destructive">{formatCurrency(-bilan.totaux.assuranceEmprunt)}</td>
                  {bilan.regime === "IS" && <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{formatCurrency(-bilan.totaux.amortissements)}</td>}
                  <td className={`py-2 px-2 text-right tabular-nums ${bilan.totaux.resultatFiscal >= 0 ? "" : "text-destructive"}`}>{formatCurrency(bilan.totaux.resultatFiscal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cash flow reel vs resultat comptable */}
          {bilan.regime === "IS" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-dashed border-muted-foreground/20 rounded-md px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-foreground">Tresorerie reelle</p>
                  <p className="text-[10px] text-muted-foreground">
                    Revenus - charges - interets - assurance (hors amortissement)
                  </p>
                </div>
                <p className={`text-lg font-bold tabular-nums ${bilan.totaux.cashFlowReel >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(bilan.totaux.cashFlowReel)}
                </p>
              </div>
              <div className="border border-dashed border-muted-foreground/20 rounded-md px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-foreground">Resultat fiscal</p>
                  <p className="text-[10px] text-muted-foreground">
                    Tresorerie - amortissements ({formatCurrency(-bilan.totaux.amortissements)})
                  </p>
                  {bilan.totaux.resultatFiscal < 0 && (
                    <p className={`text-[10px] mt-1 font-medium ${bilan.totaux.cashFlowReel >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {bilan.totaux.cashFlowReel >= 0
                        ? "Deficit comptable — pas d'impact tresorerie"
                        : "Deficit de tresorerie — possible apport necessaire"}
                    </p>
                  )}
                </div>
                <p className={`text-lg font-bold tabular-nums ${bilan.totaux.resultatFiscal >= 0 ? "" : "text-amber-600"}`}>
                  {formatCurrency(bilan.totaux.resultatFiscal)}
                </p>
              </div>
            </div>
          )}

          {/* Impot consolide SCI */}
          <div className="border border-dashed border-primary/30 bg-primary/5 rounded-md px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-foreground">Impot estime au niveau de la SCI</p>
              <p className="text-[10px] text-muted-foreground">
                Calcule sur le resultat fiscal consolide ({formatCurrency(bilan.totaux.resultatFiscal)})
              </p>
            </div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(bilan.totaux.impotEstime)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
