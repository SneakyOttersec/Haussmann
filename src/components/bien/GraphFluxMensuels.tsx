"use client";

import type { Depense, Revenu, Pret, Bien, SuiviMensuelLoyer } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { buildMonthlyFlow, computeCashflowStats } from "@/lib/monthlyFlow";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface CashFlowChartProps {
  property: Bien;
  incomes: Revenu[];
  expenses: Depense[];
  rentEntries: SuiviMensuelLoyer[];
  /** Optional loan — when provided, monthly credit is computed from the loan schedule (handles defer). */
  loan?: Pret | null;
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(v)
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ");

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? 0;
  const revenusLoyers = get("revenusLoyers");
  const revenusAutres = get("revenusAutres");
  const depenses = get("depenses");
  const credit = get("credit");
  const cashFlow = get("cashFlow");

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 11, lineHeight: 1.7, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#34d399" }}>Loyers percus</span>
        <span style={{ fontWeight: 600 }}>{fmtEur(revenusLoyers)}</span>
      </div>
      {revenusAutres !== 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <span style={{ color: "#a3e635" }}>Autres revenus</span>
          <span>{fmtEur(revenusAutres)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#fb923c" }}>Charges</span>
        <span>{fmtEur(-depenses)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#60a5fa" }}>Credit</span>
        <span>{fmtEur(-credit)}</span>
      </div>
      <div style={{ borderTop: "1px dashed #ccc", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ fontWeight: 700 }}>Cash flow</span>
        <span style={{ fontWeight: 700, color: cashFlow >= 0 ? "#16a34a" : "#991b1b" }}>{fmtEur(cashFlow)}</span>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function GraphFluxMensuels({ property, incomes, expenses, rentEntries, loan }: CashFlowChartProps) {
  const monthly = buildMonthlyFlow(property, incomes, expenses, rentEntries, loan);

  if (monthly.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">Aucune donnee depuis l&apos;acquisition.</p>
    );
  }

  // Chart data with negative signs for stacking
  const data = monthly.map((m) => ({
    mois: m.label,
    revenusLoyers: m.revenusLoyers,
    revenusAutres: m.revenusAutres,
    depenses: -m.depenses,
    credit: -m.credit,
    cashFlow: m.cashFlow,
  }));

  const stats = computeCashflowStats(monthly);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] text-muted-foreground">
        <span>
          Depuis {monthly[0].label} ({stats.nbMois} mois) :
        </span>
        <span>
          Cumule :{" "}
          <strong className={stats.global >= 0 ? "text-green-600" : "text-destructive"}>
            {formatCurrency(stats.global)}
          </strong>
        </span>
        <span>
          Mois dernier :{" "}
          <strong className={stats.lastMonth >= 0 ? "text-green-600" : "text-destructive"}>
            {formatCurrency(stats.lastMonth)}
          </strong>
        </span>
        <span>
          6 derniers mois :{" "}
          {stats.last6Months !== null ? (
            <strong className={stats.last6Months >= 0 ? "text-green-600" : "text-destructive"}>
              {formatCurrency(stats.last6Months)}
            </strong>
          ) : (
            <strong className="text-muted-foreground/50">N/A</strong>
          )}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 5 }} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} formatter={(value) => {
            const labels: Record<string, string> = {
              revenusLoyers: "Loyers",
              revenusAutres: "Autres revenus",
              depenses: "Charges",
              credit: "Credit",
              cashFlow: "Cash flow",
            };
            return labels[value] || value;
          }} />

          <Bar dataKey="revenusLoyers" stackId="stack" fill="#34d399" />
          <Bar dataKey="revenusAutres" stackId="stack" fill="#a3e635" />
          <Bar dataKey="depenses" stackId="stack" fill="#fb923c" />
          <Bar dataKey="credit" stackId="stack" fill="#60a5fa" />

          <Line type="monotone" dataKey="cashFlow" stroke="#991b1b" strokeWidth={2.5} dot={{ r: 2.5, fill: "#991b1b" }} />

          <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
