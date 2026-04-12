"use client";

import type { ChargePaymentEntry, Expense, Income, LoanDetails, Property, RentMonthEntry } from "@/types";
import { coutTotalBien } from "@/lib/utils";
import { buildMonthlyFlow } from "@/lib/monthlyFlow";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Props {
  property: Property;
  incomes: Income[];
  expenses: Expense[];
  rentEntries: RentMonthEntry[];
  loan?: LoanDetails | null;
  chargePayments?: ChargePaymentEntry[];
}

/**
 * Monthly rendement chart based on REAL values (percu/depense from rent tracking
 * + actual expenses). Each point uses a rolling 12-month window ending on that
 * month, annualized and divided by coutTotal. We need a rolling window because
 * a single-month slice is too noisy (rent is lumpy, charges are bursty).
 *
 * - Rendement brut = (loyers 12m + autres revenus 12m) / coutTotal × 100
 * - Rendement net  = (loyers 12m + autres revenus 12m − depenses 12m) / coutTotal × 100
 *
 * Credit mensuel is not counted in "charges" — rendement traditionally excludes
 * financing costs (that's what cash flow captures).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const get = (key: string): number | null => {
    const p = payload.find((p: any) => p.dataKey === key);
    return p?.value ?? null;
  };
  const brutRoll = get("rBrutRoll");
  const netRoll = get("rNetRoll");
  const brutCumul = get("rBrutCumul");
  const netCumul = get("rNetCumul");
  const fmt = (v: number | null) => v == null ? "—" : `${v.toFixed(2)} %`;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 11, lineHeight: 1.7, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", minWidth: 240 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 10, color: "#737373", marginBottom: 2 }}>12 mois glissants</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#0ea5e9" }}>Rendement brut</span>
        <span style={{ fontWeight: 600 }}>{fmt(brutRoll)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#16a34a" }}>Rendement net</span>
        <span style={{ fontWeight: 600 }}>{fmt(netRoll)}</span>
      </div>
      <div style={{ fontSize: 10, color: "#737373", marginTop: 6, marginBottom: 2 }}>Cumul depuis mise en location</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#7dd3fc" }}>Rendement brut</span>
        <span style={{ fontWeight: 600 }}>{fmt(brutCumul)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#86efac" }}>Rendement net</span>
        <span style={{ fontWeight: 600 }}>{fmt(netCumul)}</span>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function MonthlyRendementChart({ property, incomes, expenses, rentEntries, loan, chargePayments }: Props) {
  const coutTotal = coutTotalBien(property);
  const monthly = buildMonthlyFlow(property, incomes, expenses, rentEntries, loan ?? null);

  // ── Depenses reelles par mois, via chargePayments quand dispo ──
  // buildMonthlyFlow retourne la projection des expenses. Les charges saisies
  // reellement (section Charges → chargePayments) doivent les remplacer
  // poste par poste. Si l'utilisateur a saisi un paiement pour une expense
  // mais pas pour un mois donne, on garde la projection pour ce mois-la.
  const paymentsByExpByYM = new Map<string, Map<string, number>>(); // expenseId → (YYYY-MM → paidThisMonth)
  for (const p of (chargePayments ?? [])) {
    const exp = expenses.find((e) => e.id === p.expenseId);
    if (!exp || exp.categorie === "credit") continue;
    let map = paymentsByExpByYM.get(p.expenseId);
    if (!map) { map = new Map(); paymentsByExpByYM.set(p.expenseId, map); }
    if (exp.frequence === "mensuel" && /^\d{4}-\d{2}$/.test(p.periode)) {
      map.set(p.periode, (map.get(p.periode) ?? 0) + p.montantPaye);
    } else if (exp.frequence === "trimestriel") {
      const m = p.periode.match(/^(\d{4})-Q([1-4])$/);
      if (m) {
        const year = Number(m[1]);
        const startMonth = (Number(m[2]) - 1) * 3;
        const perMonth = p.montantPaye / 3;
        for (let i = 0; i < 3; i++) {
          const ym = `${year}-${String(startMonth + i + 1).padStart(2, "0")}`;
          map.set(ym, (map.get(ym) ?? 0) + perMonth);
        }
      }
    } else if (exp.frequence === "annuel" && /^\d{4}$/.test(p.periode)) {
      const year = p.periode;
      const perMonth = p.montantPaye / 12;
      for (let i = 1; i <= 12; i++) {
        const ym = `${year}-${String(i).padStart(2, "0")}`;
        map.set(ym, (map.get(ym) ?? 0) + perMonth);
      }
    }
  }

  // Recalcule depenses pour chaque mois en sommant, poste par poste :
  // - paiement reel si dispo pour (expense, mois)
  // - sinon monthly projection deja incluse dans monthly[].depenses
  // Approche : pour chaque mois on part de monthly.depenses, puis pour chaque
  // expense qui a >= 1 paiement enregistre, on SOUSTRAIT sa projection du mois
  // et on AJOUTE le paiement reel (ou 0 si pas de paiement ce mois-la).
  const monthlyEffective = monthly.map((m) => {
    let depenses = m.depenses;
    const [yStr, moStr] = m.yearMonth.split("-");
    const cursor = new Date(Number(yStr), Number(moStr) - 1, 1);
    for (const [expId, ymMap] of paymentsByExpByYM) {
      const exp = expenses.find((e) => e.id === expId);
      if (!exp) continue;
      const actual = ymMap.get(m.yearMonth) ?? 0;
      // Projection de cette expense ce mois-ci (0 si hors periode d'activite).
      // IMPORTANT : on ajoute toujours l'override `actual`, meme si l'expense
      // n'etait pas active ce mois-la — l'utilisateur a saisi un paiement
      // reel via chargePayments, qui couvre la periode meme si la dateDebut
      // de la definition est ulterieure.
      const start = new Date(exp.dateDebut);
      const end = exp.dateFin ? new Date(exp.dateFin) : null;
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const isActive = !(start > monthEnd || (end && end < monthStart));
      const projected = isActive
        ? (exp.frequence === "mensuel" ? exp.montant
           : exp.frequence === "trimestriel" ? exp.montant / 3
           : exp.frequence === "annuel" ? exp.montant / 12
           : 0)
        : 0;
      depenses = depenses - projected + actual;
    }
    return { ...m, depenses: Math.max(0, Math.round(depenses)) };
  });

  if (coutTotal <= 0 || monthlyEffective.length === 0) {
    return (
      <div className="border border-dashed border-muted-foreground/30 rounded-md p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Pas encore assez de donnees reelles pour calculer le rendement mensuel.
        </p>
      </div>
    );
  }

  // Deux lectures complementaires :
  // - Rolling 12 mois : fenetre glissante, capte les variations recentes.
  // - Cumul depuis la mise en location : tout l'historique depuis que le bien
  //   est loue, annualise. Plus stable mais lisse les changements.
  const miseEnLocDate = property.statusDates?.location;
  const miseEnLocYM = miseEnLocDate ? miseEnLocDate.slice(0, 7) : null; // "YYYY-MM"
  // Index du premier mois >= mise en location (ou premier mois avec rent entry
  // en fallback).
  let cumulStartIdx = -1;
  if (miseEnLocYM) {
    cumulStartIdx = monthlyEffective.findIndex((m) => m.yearMonth >= miseEnLocYM);
  }
  if (cumulStartIdx < 0) {
    cumulStartIdx = monthlyEffective.findIndex((m) => m.revenusLoyers > 0);
  }

  const data = monthlyEffective.map((m, i) => {
    // ── Rolling 12 mois ──
    const rollWindow = monthlyEffective.slice(Math.max(0, i - 11), i + 1);
    const rollN = rollWindow.length;
    const rollLoyers = rollWindow.reduce((s, x) => s + x.revenusLoyers + x.revenusAutres, 0);
    const rollDepenses = rollWindow.reduce((s, x) => s + x.depenses, 0);
    const rollFactor = 12 / rollN;
    const rBrutRoll = ((rollLoyers * rollFactor) / coutTotal) * 100;
    const rNetRoll = (((rollLoyers - rollDepenses) * rollFactor) / coutTotal) * 100;

    // ── Cumul depuis la mise en location ──
    let rBrutCumul: number | null = null;
    let rNetCumul: number | null = null;
    if (cumulStartIdx >= 0 && i >= cumulStartIdx) {
      const cumulWindow = monthlyEffective.slice(cumulStartIdx, i + 1);
      const cumulN = cumulWindow.length;
      const cumulLoyers = cumulWindow.reduce((s, x) => s + x.revenusLoyers + x.revenusAutres, 0);
      const cumulDepenses = cumulWindow.reduce((s, x) => s + x.depenses, 0);
      const cumulFactor = 12 / cumulN;
      rBrutCumul = ((cumulLoyers * cumulFactor) / coutTotal) * 100;
      rNetCumul = (((cumulLoyers - cumulDepenses) * cumulFactor) / coutTotal) * 100;
    }

    return {
      label: m.label,
      rBrutRoll: Math.round(rBrutRoll * 100) / 100,
      rNetRoll: Math.round(rNetRoll * 100) / 100,
      rBrutCumul: rBrutCumul != null ? Math.round(rBrutCumul * 100) / 100 : null,
      rNetCumul: rNetCumul != null ? Math.round(rNetCumul * 100) / 100 : null,
    };
  });

  // Tronque l'historique apres le dernier mois avec un loyer percu (sinon les
  // rolling-windows aspirent des zeros et les courbes plongent a droite sans
  // que ce soit une info utile).
  const lastRentIdx = monthlyEffective.reduce(
    (acc, m, i) => (m.revenusLoyers > 0 ? i : acc),
    -1,
  );
  const dataTrim = lastRentIdx >= 0 ? data.slice(0, lastRentIdx + 1) : data;

  return (
    <div className="w-full">
      <div className="w-full h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataTrim} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e5e5e5" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `${v.toFixed(1)} %`}
              domain={["auto", "auto"]}
              width={50}
            />
            <Tooltip content={<ChartTooltip />} wrapperStyle={{ zIndex: 50 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={10} />
            <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
            <Line type="monotone" dataKey="rBrutRoll" name="Brut 12m" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="rNetRoll" name="Net 12m" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="rBrutCumul" name="Brut cumul" stroke="#7dd3fc" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="rNetCumul" name="Net cumul" stroke="#86efac" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 italic leading-relaxed">
        Pleines : fenetre glissante 12 mois (capte les variations). Pointillees : cumul depuis la mise en location (converge vers le rendement reel). Base sur les loyers percus et les depenses reelles (y compris paiements trackes dans l&apos;onglet Charges).
        {lastRentIdx >= 0 && lastRentIdx < monthlyEffective.length - 1 && (
          <> Affichage jusqu&apos;au dernier mois de loyer percu ({monthlyEffective[lastRentIdx].label}).</>
        )}
      </p>
    </div>
  );
}
