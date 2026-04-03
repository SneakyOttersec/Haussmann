"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/hooks/useLocalStorage";
import type { AppData } from "@/types";
import { computeBilanFiscal, getAvailableYears } from "@/lib/calculations/fiscal-bilan";
import { formatCurrency, mensualiserMontant, annualiserMontant } from "@/lib/utils";
import { capitalRestantDu } from "@/lib/calculations/loan";
import { coutTotalBien } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface MonthlyFinance {
  mois: string;
  revenus: number;
  depenses: number;
  credit: number;
  cashFlow: number;
  cumulCashFlow: number;
}

interface PatrimoineMonth {
  mois: string;
  valeurBiens: number;
  capitalRestantDu: number;
  patrimoineNet: number;
}

function buildMonthlyCashFlow(data: AppData): MonthlyFinance[] {
  const now = new Date();
  const months: MonthlyFinance[] = [];
  let cumul = 0;

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    let revenus = 0, depenses = 0, credit = 0;

    for (const inc of data.incomes) {
      const start = new Date(inc.dateDebut);
      const end = inc.dateFin ? new Date(inc.dateFin) : null;
      if (start > monthEnd || (end && end < d)) continue;
      if (inc.frequence === "ponctuel") {
        if (start.getFullYear() === d.getFullYear() && start.getMonth() === d.getMonth()) revenus += inc.montant;
      } else {
        revenus += mensualiserMontant(inc.montant, inc.frequence);
      }
    }

    for (const exp of data.expenses) {
      const start = new Date(exp.dateDebut);
      const end = exp.dateFin ? new Date(exp.dateFin) : null;
      if (start > monthEnd || (end && end < d)) continue;
      let m = 0;
      if (exp.frequence === "ponctuel") {
        if (start.getFullYear() === d.getFullYear() && start.getMonth() === d.getMonth()) m = exp.montant;
      } else {
        m = mensualiserMontant(exp.montant, exp.frequence);
      }
      if (exp.categorie === "credit") credit += m; else depenses += m;
    }

    const cf = Math.round(revenus - depenses - credit);
    cumul += cf;
    months.push({ mois: label, revenus: Math.round(revenus), depenses: Math.round(depenses), credit: Math.round(credit), cashFlow: cf, cumulCashFlow: cumul });
  }
  return months;
}

function buildPatrimoine(data: AppData): PatrimoineMonth[] {
  const now = new Date();
  const months: PatrimoineMonth[] = [];

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

    let totalValeur = 0, totalCRD = 0;

    for (const p of data.properties) {
      totalValeur += coutTotalBien(p);
    }

    for (const loan of data.loans) {
      const loanStart = new Date(loan.dateDebut);
      const monthsElapsed = (d.getFullYear() - loanStart.getFullYear()) * 12 + (d.getMonth() - loanStart.getMonth());
      if (monthsElapsed < 0) { totalCRD += loan.montantEmprunte; continue; }
      const yearsElapsed = monthsElapsed / 12;
      totalCRD += capitalRestantDu(loan.montantEmprunte, loan.tauxAnnuel, loan.dureeAnnees, yearsElapsed, loan.type);
    }

    months.push({ mois: label, valeurBiens: Math.round(totalValeur), capitalRestantDu: Math.round(totalCRD), patrimoineNet: Math.round(totalValeur - totalCRD) });
  }
  return months;
}

const fmtEur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");

/* eslint-disable @typescript-eslint/no-explicit-any */
function CashFlowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? 0;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 11, lineHeight: 1.7, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#34d399" }}>Revenus</span><span style={{ fontWeight: 600 }}>{fmtEur(get("revenus"))}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#fb923c" }}>Charges</span><span>{fmtEur(get("depenses"))}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#60a5fa" }}>Credit</span><span>{fmtEur(get("credit"))}</span></div>
      <div style={{ borderTop: "1px dashed #ccc", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ fontWeight: 700 }}>Cash flow</span><span style={{ fontWeight: 700, color: get("cashFlow") >= 0 ? "#16a34a" : "#991b1b" }}>{fmtEur(get("cashFlow"))}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span>Cumule</span><span style={{ fontWeight: 600, color: get("cumulCashFlow") >= 0 ? "#16a34a" : "#991b1b" }}>{fmtEur(get("cumulCashFlow"))}</span></div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function Finances() {
  const { data } = useAppData();
  const [bilanYear, setBilanYear] = useState(new Date().getFullYear());

  const cashFlowData = useMemo(() => data ? buildMonthlyCashFlow(data) : [], [data]);
  const patrimoineData = useMemo(() => data ? buildPatrimoine(data) : [], [data]);
  const bilan = useMemo(() => data ? computeBilanFiscal(data, bilanYear) : null, [data, bilanYear]);
  const availableYears = useMemo(() => data ? getAvailableYears(data) : [], [data]);

  if (!data) return null;

  const seuil = data.settings.seuilAlerteTresorerie ?? 0;
  const lastCumul = cashFlowData.length > 0 ? cashFlowData[cashFlowData.length - 1].cumulCashFlow : 0;
  const alertActive = seuil > 0 && lastCumul < seuil;

  const totalRevenus = data.incomes.reduce((s, i) => s + annualiserMontant(i.montant, i.frequence), 0);
  const totalDepenses = data.expenses.reduce((s, e) => s + annualiserMontant(e.montant, e.frequence), 0);
  const cashFlowAnnuel = totalRevenus - totalDepenses;

  return (
    <div className="space-y-6">
      <h1>Finances</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-dotted"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Revenus annuels</p>
          <p className="text-lg font-bold">{formatCurrency(totalRevenus)}</p>
        </CardContent></Card>
        <Card className="border-dotted"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Depenses annuelles</p>
          <p className="text-lg font-bold">{formatCurrency(totalDepenses)}</p>
        </CardContent></Card>
        <Card className="border-dotted"><CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Cash flow annuel</p>
          <p className={`text-lg font-bold ${cashFlowAnnuel >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(cashFlowAnnuel)}</p>
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

      {/* Cash flow chart */}
      <div className="border border-dotted rounded-md p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Flux mensuels (24 derniers mois)</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={cashFlowData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
            <Tooltip content={<CashFlowTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
            <Bar dataKey="revenus" stackId="stack" fill="#34d399" name="Revenus" />
            <Bar dataKey="depenses" stackId="stack" fill="#fb923c" name="Charges" />
            <Bar dataKey="credit" stackId="stack" fill="#60a5fa" name="Credit" />
            <Line type="monotone" dataKey="cashFlow" stroke="#991b1b" strokeWidth={2} dot={{ r: 1.5 }} name="Cash flow" />
            <Line type="monotone" dataKey="cumulCashFlow" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Cumule" />
            <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
            {seuil > 0 && <ReferenceLine y={seuil} stroke="#dc2626" strokeWidth={1} strokeDasharray="4 4" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Patrimoine chart */}
      <div className="border border-dotted rounded-md p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Patrimoine net (24 derniers mois)</p>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={patrimoineData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => [fmtEur(Number(value))]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Line type="monotone" dataKey="valeurBiens" stroke="#34d399" strokeWidth={1.5} dot={false} name="Valeur biens" />
            <Line type="monotone" dataKey="capitalRestantDu" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Capital restant du" />
            <Line type="monotone" dataKey="patrimoineNet" stroke="oklch(0.52 0.07 175)" strokeWidth={2.5} dot={{ r: 2 }} name="Patrimoine net" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bilan fiscal */}
      {bilan && bilan.rows.length > 0 && (
        <div className="border border-dotted rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bilan fiscal — SC a l&apos;{bilan.regime}</p>
            <div className="flex items-center gap-1">
              {availableYears.map((y) => (
                <button key={y} onClick={() => setBilanYear(y)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${bilanYear === y ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted"}`}
                >{y}</button>
              ))}
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
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Impot</th>
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
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(r.impotEstime)}</td>
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
                  <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(bilan.totaux.impotEstime)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
