"use client";

import { useState, useEffect, useMemo } from "react";
import type { Property, Income, Expense, LoanDetails, RentMonthEntry, YearProjection, CalculatorInputs, PropertyStatus } from "@/types";
import { loadSimulations, hydrateSimulation } from "@/lib/simulations";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { calculerRentabilite } from "@/lib/calculations";
import { formatCurrency, getPropertyAcquisitionDate } from "@/lib/utils";
import { buildMonthlyFlow } from "@/lib/monthlyFlow";

/** Real cash flow only makes sense once the property is generating rent (location or beyond). */
function isOperating(statut?: PropertyStatus): boolean {
  return statut === "location" || statut === "exploitation";
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface Props {
  property: Property;
  incomes: Income[];
  expenses: Expense[];
  rentEntries: RentMonthEntry[];
  loan?: LoanDetails | null;
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(v).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");

interface SimBreakdown {
  loyerNet: number;
  charges: number;
  mensualitesCredit: number;
  cashFlowAvantImpot: number;
}

interface RealBreakdown {
  loyersPercus: number;
  revenusAutres: number;
  depenses: number;
  credit: number;
  cashFlow: number;
  monthsUsed: number;
  isExtrapolated: boolean;
}

interface RealYearData {
  yearIdx: number;
  annualCF: number;
  monthsUsed: number;
  isExtrapolated: boolean;
  breakdown: { loyersPercus: number; revenusAutres: number; depenses: number; credit: number };
}

interface ChartPoint {
  annee: string;
  simule: number;
  reel: number | null;
  simBreakdown: SimBreakdown;
  realBreakdown: RealBreakdown | null;
}

// Tooltip rows are hoisted out of the parent function so React Compiler can
// memoize them properly (defining components inside render confuses the compiler).
function TooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ color: color ?? "#666" }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? undefined, fontVariantNumeric: "tabular-nums" }}>
        {fmtEur(value)}
      </span>
    </div>
  );
}

function TooltipTotal({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        marginTop: 4,
        paddingTop: 4,
        borderTop: "1px dashed #ccc",
      }}
    >
      <span style={{ fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 700, color: value >= 0 ? "#16a34a" : "#991b1b", fontVariantNumeric: "tabular-nums" }}>
        {fmtEur(value)}
      </span>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function BreakdownTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) return null;
  const sim = point.simBreakdown;
  const real = point.realBreakdown;
  const ecart = real ? real.cashFlow - sim.cashFlowAvantImpot : 0;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 11,
        lineHeight: 1.7,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        minWidth: 240,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>

      {/* Simule */}
      <div style={{ marginBottom: real ? 8 : 0 }}>
        <div style={{ color: "#60a5fa", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
          Simule (avant impot)
        </div>
        <TooltipRow label="Loyer net" value={sim.loyerNet} color="#16a34a" />
        <TooltipRow label="− Charges" value={-sim.charges} color="#fb923c" />
        <TooltipRow label="− Mensualites credit" value={-sim.mensualitesCredit} color="#60a5fa" />
        <TooltipTotal label="= Cash flow" value={sim.cashFlowAvantImpot} />
      </div>

      {/* Reel — only on the matching year */}
      {real && (
        <div>
          <div style={{ color: "#16a34a", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Reel (avant impot){real.isExtrapolated ? ` — extrapole sur ${real.monthsUsed}m` : " — 12 derniers mois"}
          </div>
          <TooltipRow label="Loyers percus" value={real.loyersPercus} color="#16a34a" />
          {real.revenusAutres !== 0 && <TooltipRow label="+ Autres revenus" value={real.revenusAutres} color="#a3e635" />}
          <TooltipRow label="− Charges" value={-real.depenses} color="#fb923c" />
          <TooltipRow label="− Credit" value={-real.credit} color="#60a5fa" />
          <TooltipTotal label="= Cash flow" value={real.cashFlow} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              marginTop: 4,
              fontSize: 10,
              color: "#666",
            }}
          >
            <span>Ecart vs simule</span>
            <span style={{ fontWeight: 600, color: ecart >= 0 ? "#16a34a" : "#991b1b", fontVariantNumeric: "tabular-nums" }}>
              {ecart >= 0 ? "+" : ""}{fmtEur(ecart)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function RealVsSimulatedSection({ property, incomes, expenses, rentEntries, loan }: Props) {
  const [projection, setProjection] = useState<YearProjection[] | null>(null);
  // Counter bumped to force-reload the simulation from localStorage.
  // Incremented by a "Recharger" button so the user can pull fresh data
  // after editing the simulation in the simulator.
  const [reloadKey, setReloadKey] = useState(0);
  // Hide the "real" curve until the property is actually generating rent.
  // Until then there is no meaningful real cash flow to compare against the simulator.
  const operating = isOperating(property.statut);

  useEffect(() => {
    if (!property.simulationId) return;
    const sims = loadSimulations();
    const sim = sims.find((s) => s.id === property.simulationId);
    if (!sim) return;
    hydrateSimulation(sim).then((hydrated) => {
      const inputs: CalculatorInputs = { ...DEFAULT_CALCULATOR_INPUTS, ...hydrated };
      const results = calculerRentabilite(inputs);
      setProjection(results.projection);
    });
  }, [property.simulationId, reloadKey]);

  /**
   * Real cash flow built from the SAME source of truth as the rest of the app:
   * buildMonthlyFlow respects rent tracking, expense revisions, dateDebut/dateFin,
   * and the loan defer schedule. We then sum the trailing 12 months and, if the
   * property is younger than 12 months, extrapolate from what we have so the
   * comparison vs the simulator's annual projection stays meaningful.
   *
   * We also expose the breakdown (loyers / autres revenus / charges / credit) so
   * the chart tooltip can show how the figure was built.
   */
  /**
   * Build real CF per ownership year. Monthly flow is grouped into 12-month
   * windows aligned on the acquisition date: A1 = months 0-11, A2 = months 12-23, etc.
   * The last (current) year may have < 12 months → extrapolated to annual.
   */
  const { realByYear, yearsOwned } = useMemo(() => {
    const monthly = buildMonthlyFlow(property, incomes, expenses, rentEntries, loan ?? null);
    if (monthly.length === 0) return { realByYear: [] as RealYearData[], yearsOwned: 0 };

    const nbYears = Math.max(1, Math.ceil(monthly.length / 12));
    const result: RealYearData[] = [];

    for (let y = 0; y < nbYears; y++) {
      const window = monthly.slice(y * 12, (y + 1) * 12);
      const monthsUsed = window.length;
      if (monthsUsed === 0) continue;
      const sumLoyers = window.reduce((s, m) => s + m.revenusLoyers, 0);
      const sumAutres = window.reduce((s, m) => s + m.revenusAutres, 0);
      const sumDepenses = window.reduce((s, m) => s + m.depenses, 0);
      const sumCredit = window.reduce((s, m) => s + m.credit, 0);
      const sumCF = window.reduce((s, m) => s + m.cashFlow, 0);
      const factor = monthsUsed >= 12 ? 1 : 12 / monthsUsed;
      result.push({
        yearIdx: y, // 0-based → maps to A(y+1)
        annualCF: sumCF * factor,
        monthsUsed,
        isExtrapolated: monthsUsed < 12,
        breakdown: {
          loyersPercus: sumLoyers * factor,
          revenusAutres: sumAutres * factor,
          depenses: sumDepenses * factor,
          credit: sumCredit * factor,
        },
      });
    }
    return { realByYear: result, yearsOwned: nbYears };
  }, [property, incomes, expenses, rentEntries, loan]);

  if (!property.simulationId) return null;
  if (!projection) return null;

  const years = Math.min(10, projection.length);
  // Build a lookup of real data by year index for O(1) access in the loop.
  const realLookup = new Map(realByYear.map((r) => [r.yearIdx, r]));
  const latestReal = realByYear.length > 0 ? realByYear[realByYear.length - 1] : null;

  const data: ChartPoint[] = [];
  for (let i = 0; i < years; i++) {
    const p = projection[i];
    // Show real data for every year we have tracking data — not just one point.
    const realYear = operating ? realLookup.get(i) ?? null : null;
    data.push({
      annee: `A${i + 1}`,
      simule: Math.round(p.cashFlowAvantImpot),
      reel: realYear ? Math.round(realYear.annualCF) : null,
      simBreakdown: {
        loyerNet: Math.round(p.loyerNet),
        charges: Math.round(p.charges),
        mensualitesCredit: Math.round(p.mensualitesCredit),
        cashFlowAvantImpot: Math.round(p.cashFlowAvantImpot),
      },
      realBreakdown: realYear
        ? {
            loyersPercus: Math.round(realYear.breakdown.loyersPercus),
            revenusAutres: Math.round(realYear.breakdown.revenusAutres),
            depenses: Math.round(realYear.breakdown.depenses),
            credit: Math.round(realYear.breakdown.credit),
            cashFlow: Math.round(realYear.annualCF),
            monthsUsed: realYear.monthsUsed,
            isExtrapolated: realYear.isExtrapolated,
          }
        : null,
    });
  }

  const latestRealCF = latestReal?.annualCF ?? 0;
  const simRefYear = latestReal && latestReal.yearIdx < years
    ? (projection[latestReal.yearIdx]?.cashFlowAvantImpot ?? 0)
    : 0;
  const ecart = latestRealCF - simRefYear;

  return (
    <Card className="border-dotted">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Reel vs Simule</CardTitle>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
          title="Recharger la simulation depuis les donnees sauvegardees"
        >
          ↻ Recharger la simulation
        </button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
          {operating && latestReal && (
            <>
              <span>
                CF reel A{latestReal.yearIdx + 1}{latestReal.isExtrapolated ? ` (extrapole sur ${latestReal.monthsUsed}m)` : ""} :{" "}
                <strong className={latestRealCF >= 0 ? "text-green-600" : "text-destructive"}>
                  {formatCurrency(latestRealCF)}
                </strong>
              </span>
              <span>
                Ecart :{" "}
                <strong className={ecart >= 0 ? "text-green-600" : "text-destructive"}>
                  {ecart >= 0 ? "+" : ""}{formatCurrency(ecart)}
                </strong>
              </span>
            </>
          )}
          <span>
            CF simule (A{latestReal ? latestReal.yearIdx + 1 : 1}) :{" "}
            <strong className="text-foreground">{formatCurrency(simRefYear)}</strong>
          </span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="annee" tick={{ fontSize: 10 }} />
            {/* Left axis — Simule (blue) */}
            <YAxis
              yAxisId="simule"
              orientation="left"
              tick={{ fontSize: 10, fill: "#60a5fa" }}
              stroke="#60a5fa"
              domain={["auto", "auto"]}
              allowDecimals={false}
              tickFormatter={(v: number) => {
                const abs = Math.abs(v);
                if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
                return `${v}`;
              }}
            />
            {/* Right axis — Reel (green), only when operating */}
            {operating && (
              <YAxis
                yAxisId="reel"
                orientation="right"
                tick={{ fontSize: 10, fill: "#16a34a" }}
                stroke="#16a34a"
                domain={["auto", "auto"]}
                allowDecimals={false}
                tickFormatter={(v: number) => {
                  const abs = Math.abs(v);
                  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
                  return `${v}`;
                }}
              />
            )}
            <Tooltip content={<BreakdownTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Line yAxisId="simule" type="monotone" dataKey="simule" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} name="Simule (avant impot)" />
            {operating && (
              <Line yAxisId="reel" type="monotone" dataKey="reel" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: "#16a34a" }} name="Reel (avant impot)" connectNulls={false} />
            )}
            <ReferenceLine yAxisId="simule" y={0} stroke="#999" strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Comparaison <strong>avant impot</strong> : meme convention des deux cotes.
          {operating ? (
            <>
              {" "}La courbe verte montre le cash flow reel annualise pour chaque annee d&apos;exploitation
              ({yearsOwned} annee{yearsOwned > 1 ? "s" : ""} de donnees).
              {latestReal?.isExtrapolated && ` L'annee en cours (A${yearsOwned}) est extrapolee sur ${latestReal.monthsUsed} mois.`}
            </>
          ) : (
            <>
              {" "}Le bien n&apos;est pas encore en location — la courbe reelle s&apos;affichera des
              que le bien sera passe en phase &quot;Mise en location&quot; ou &quot;Exploitation&quot;.
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
