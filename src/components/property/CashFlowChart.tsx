"use client";

import type { Expense, Income } from "@/types";
import { annualiserMontant, formatCurrency } from "@/lib/utils";
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
  incomes: Income[];
  expenses: Expense[];
}

interface MonthData {
  mois: string;
  revenus: number;
  depenses: number;
  credit: number;
  cashFlow: number;
}

function buildMonthlyData(incomes: Income[], expenses: Expense[]): MonthData[] {
  const now = new Date();
  const months: MonthData[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const monthStart = d;
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    let revenus = 0;
    let depenses = 0;
    let credit = 0;

    for (const inc of incomes) {
      const start = new Date(inc.dateDebut);
      const end = inc.dateFin ? new Date(inc.dateFin) : null;
      if (start > monthEnd) continue;
      if (end && end < monthStart) continue;

      if (inc.frequence === "ponctuel") {
        if (start.getFullYear() === d.getFullYear() && start.getMonth() === d.getMonth()) {
          revenus += inc.montant;
        }
      } else if (inc.frequence === "mensuel") {
        revenus += inc.montant;
      } else if (inc.frequence === "trimestriel") {
        const monthsDiff = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
        if (monthsDiff >= 0 && monthsDiff % 3 === 0) {
          revenus += inc.montant;
        } else {
          revenus += inc.montant / 3;
        }
      } else if (inc.frequence === "annuel") {
        revenus += inc.montant / 12;
      }
    }

    for (const exp of expenses) {
      const start = new Date(exp.dateDebut);
      const end = exp.dateFin ? new Date(exp.dateFin) : null;
      if (start > monthEnd) continue;
      if (end && end < monthStart) continue;

      const isCredit = exp.categorie === "credit";
      let montant = 0;

      if (exp.frequence === "ponctuel") {
        if (start.getFullYear() === d.getFullYear() && start.getMonth() === d.getMonth()) {
          montant = exp.montant;
        }
      } else if (exp.frequence === "mensuel") {
        montant = exp.montant;
      } else if (exp.frequence === "trimestriel") {
        const monthsDiff = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
        if (monthsDiff >= 0 && monthsDiff % 3 === 0) {
          montant = exp.montant;
        } else {
          montant = exp.montant / 3;
        }
      } else if (exp.frequence === "annuel") {
        montant = exp.montant / 12;
      }

      if (isCredit) {
        credit += montant;
      } else {
        depenses += montant;
      }
    }

    months.push({
      mois: label,
      revenus: Math.round(revenus),
      depenses: -Math.round(depenses),
      credit: -Math.round(credit),
      cashFlow: Math.round(revenus - depenses - credit),
    });
  }

  return months;
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
  const revenus = get("revenus");
  const depenses = get("depenses");
  const credit = get("credit");
  const cashFlow = get("cashFlow");

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 11, lineHeight: 1.7, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#34d399" }}>Revenus</span>
        <span style={{ fontWeight: 600 }}>{fmtEur(revenus)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#fb923c" }}>Charges</span>
        <span>{fmtEur(depenses)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#60a5fa" }}>Credit</span>
        <span>{fmtEur(credit)}</span>
      </div>
      <div style={{ borderTop: "1px dashed #ccc", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ fontWeight: 700 }}>Cash flow</span>
        <span style={{ fontWeight: 700, color: cashFlow >= 0 ? "#16a34a" : "#991b1b" }}>{fmtEur(cashFlow)}</span>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function CashFlowChart({ incomes, expenses }: CashFlowChartProps) {
  const data = buildMonthlyData(incomes, expenses);

  if (incomes.length === 0 && expenses.length === 0) {
    return null;
  }

  const revenuAnnuel = incomes.reduce((s, i) => s + annualiserMontant(i.montant, i.frequence), 0);
  const depenseAnnuel = expenses.filter(e => e.categorie !== "credit").reduce((s, e) => s + annualiserMontant(e.montant, e.frequence), 0);
  const creditAnnuel = expenses.filter(e => e.categorie === "credit").reduce((s, e) => s + annualiserMontant(e.montant, e.frequence), 0);
  const cashFlowAnnuel = revenuAnnuel - depenseAnnuel - creditAnnuel;

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-[11px] text-muted-foreground">
        <span>Revenus : <strong className="text-foreground">{formatCurrency(revenuAnnuel)}/an</strong></span>
        <span>Charges : <strong className="text-foreground">{formatCurrency(depenseAnnuel)}/an</strong></span>
        <span>Credit : <strong className="text-foreground">{formatCurrency(creditAnnuel)}/an</strong></span>
        <span>Cash flow : <strong className={cashFlowAnnuel >= 0 ? "text-green-600" : "text-destructive"}>{formatCurrency(cashFlowAnnuel)}/an</strong></span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 5 }} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} formatter={(value) => {
            const labels: Record<string, string> = { revenus: "Revenus", depenses: "Charges", credit: "Credit", cashFlow: "Cash flow" };
            return labels[value] || value;
          }} />

          <Bar dataKey="revenus" stackId="stack" fill="#34d399" />
          <Bar dataKey="depenses" stackId="stack" fill="#fb923c" />
          <Bar dataKey="credit" stackId="stack" fill="#60a5fa" />

          <Line type="monotone" dataKey="cashFlow" stroke="#991b1b" strokeWidth={2.5} dot={{ r: 2.5, fill: "#991b1b" }} />

          <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
