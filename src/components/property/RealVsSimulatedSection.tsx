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
  }, [property.simulationId]);

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
  const realStats = useMemo(() => {
    const monthly = buildMonthlyFlow(property, incomes, expenses, rentEntries, loan ?? null);
    if (monthly.length === 0) {
      return {
        annualCF: 0,
        monthsUsed: 0,
        isExtrapolated: false,
        breakdown: { loyersPercus: 0, revenusAutres: 0, depenses: 0, credit: 0 },
      };
    }
    const window = monthly.slice(-12);
    const monthsUsed = window.length;
    const sumLoyers = window.reduce((s, m) => s + m.revenusLoyers, 0);
    const sumAutres = window.reduce((s, m) => s + m.revenusAutres, 0);
    const sumDepenses = window.reduce((s, m) => s + m.depenses, 0);
    const sumCredit = window.reduce((s, m) => s + m.credit, 0);
    const sumCF = window.reduce((s, m) => s + m.cashFlow, 0);
    const factor = monthsUsed >= 12 ? 1 : 12 / monthsUsed;
    return {
      annualCF: sumCF * factor,
      monthsUsed,
      isExtrapolated: monthsUsed < 12,
      breakdown: {
        loyersPercus: sumLoyers * factor,
        revenusAutres: sumAutres * factor,
        depenses: sumDepenses * factor,
        credit: sumCredit * factor,
      },
    };
  }, [property, incomes, expenses, rentEntries, loan]);

  /** Years of ownership — used to align the real point on the right year of the projection. */
  const yearsOwned = useMemo(() => {
    const acq = new Date(getPropertyAcquisitionDate(property));
    if (isNaN(acq.getTime())) return 1;
    const now = new Date();
    const months = (now.getFullYear() - acq.getFullYear()) * 12 + (now.getMonth() - acq.getMonth());
    return Math.max(1, Math.floor(months / 12) + 1); // year index, 1-based
  }, [property]);

  if (!property.simulationId) return null;
  if (!projection) return null;

  const years = Math.min(10, projection.length);
  // Clamp the year index to the projection length so the real point still appears.
  const realYearIdx = Math.min(yearsOwned, years) - 1;
  const data: ChartPoint[] = [];
  for (let i = 0; i < years; i++) {
    const p = projection[i];
    // The "real" year point is only meaningful when the property is actually
    // generating rent. Pre-location, leave it null so the curve is suppressed.
    const isRealYear = operating && i === realYearIdx;
    data.push({
      annee: `A${i + 1}`,
      // Compare BEFORE TAX on both sides — the real CF doesn't have a tax model
      // here, so apples-to-apples means using cashFlowAvantImpot from the simulator.
      simule: Math.round(p.cashFlowAvantImpot),
      reel: isRealYear ? Math.round(realStats.annualCF) : null,
      simBreakdown: {
        loyerNet: Math.round(p.loyerNet),
        charges: Math.round(p.charges),
        mensualitesCredit: Math.round(p.mensualitesCredit),
        cashFlowAvantImpot: Math.round(p.cashFlowAvantImpot),
      },
      realBreakdown: isRealYear
        ? {
            loyersPercus: Math.round(realStats.breakdown.loyersPercus),
            revenusAutres: Math.round(realStats.breakdown.revenusAutres),
            depenses: Math.round(realStats.breakdown.depenses),
            credit: Math.round(realStats.breakdown.credit),
            cashFlow: Math.round(realStats.annualCF),
            monthsUsed: realStats.monthsUsed,
            isExtrapolated: realStats.isExtrapolated,
          }
        : null,
    });
  }

  const simRefYear = projection[realYearIdx]?.cashFlowAvantImpot ?? 0;
  const ecart = realStats.annualCF - simRefYear;

  return (
    <Card className="border-dotted">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Reel vs Simule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
          {operating && (
            <>
              <span>
                CF annuel reel{realStats.isExtrapolated ? ` (extrapole sur ${realStats.monthsUsed}m)` : " (12 derniers mois)"} :{" "}
                <strong className={realStats.annualCF >= 0 ? "text-green-600" : "text-destructive"}>
                  {formatCurrency(realStats.annualCF)}
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
            CF annuel simule (A{realYearIdx + 1}) :{" "}
            <strong className="text-foreground">{formatCurrency(simRefYear)}</strong>
          </span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="annee" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
            <Tooltip content={<BreakdownTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Line type="monotone" dataKey="simule" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} name="Simule (avant impot)" />
            {operating && (
              <Line type="monotone" dataKey="reel" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: "#16a34a" }} name="Reel (avant impot)" connectNulls={false} />
            )}
            <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Comparaison <strong>avant impot</strong> : meme convention des deux cotes.
          {operating ? (
            <>
              {" "}Le point vert est aligne sur l&apos;annee d&apos;exploitation correspondante (
              {yearsOwned > years ? `> A${years}, clampe sur A${years}` : `A${realYearIdx + 1}`}
              ). Le reel est calcule a partir des loyers tracks, des charges (avec revisions),
              et de la mensualite credit du mois (gere le differe).
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
