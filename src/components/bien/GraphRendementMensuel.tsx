"use client";

import { useState } from "react";
import type { PaiementCharge, Depense, Revenu, Pret, Bien, SuiviMensuelLoyer } from "@/types";
import { coutTotalBien } from "@/lib/utils";
import { buildMonthlyFlow } from "@/lib/monthlyFlow";
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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

const CURVE_DEFINITIONS: { label: string; color: string; desc: string }[] = [
  { label: "Brut 12m", color: "#0ea5e9", desc: "Rendement brut sur les 12 derniers mois glissants (loyers percus / cout total, annualise). Reagit aux variations recentes." },
  { label: "Net 12m", color: "#16a34a", desc: "Rendement net 12 mois glissants (loyers − charges). Credit exclu (capture par le cash flow)." },
  { label: "Brut cumul", color: "#7dd3fc", desc: "Rendement brut cumulatif depuis la mise en location, annualise. Plus stable, converge vers le rendement reel observe." },
  { label: "Net cumul", color: "#86efac", desc: "Rendement net cumulatif depuis la mise en location (loyers − charges cumulees). Reference long-terme." },
];

function CurvesInfoTooltip() {
  return (
    <UiTooltip>
      <TooltipTrigger render={
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors select-none cursor-help"
        />
      }>
        <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-current text-[9px] leading-none">?</span>
        Information
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="z-[100] bg-background text-foreground border border-dotted border-muted-foreground/30 shadow-lg p-3 w-[90vw] max-w-2xl"
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
          {CURVE_DEFINITIONS.map((d) => (
            <div key={d.label} className="space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.label}
              </div>
              <div className="text-muted-foreground leading-snug">{d.desc}</div>
            </div>
          ))}
        </div>
      </TooltipContent>
    </UiTooltip>
  );
}

interface Props {
  property: Bien;
  incomes: Revenu[];
  expenses: Depense[];
  rentEntries: SuiviMensuelLoyer[];
  loan?: Pret | null;
  chargePayments?: PaiementCharge[];
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
function ChartTooltip({ active, payload, label, showBrutRoll, showNetRoll, showBrutCumul, showNetCumul }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as {
    rBrutRoll: number;
    rNetRoll: number;
    rBrutCumul: number | null;
    rNetCumul: number | null;
    loyersAnnRoll: number;
    chargesAnnRoll: number;
    loyersAnnCumul: number | null;
    chargesAnnCumul: number | null;
    rollN: number;
    cumulN: number | null;
    coutTotal: number;
  } | undefined;
  if (!point) return null;
  const fmt = (v: number | null) => v == null ? "—" : `${v.toFixed(2)} %`;
  const fc = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const showRoll = showBrutRoll || showNetRoll;
  const showCumul = showBrutCumul || showNetCumul;
  if (!showRoll && !showCumul) return null;
  const row = (color: string, lbl: string, val: string, bold = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
      <span style={{ color }}>{lbl}</span>
      <span style={{ fontWeight: bold ? 700 : 500, fontVariantNumeric: "tabular-nums" }}>{val}</span>
    </div>
  );
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 11, lineHeight: 1.6, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", minWidth: 260 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {showRoll && (
        <>
          <div style={{ fontSize: 10, color: "#737373", marginBottom: 2 }}>
            12 mois glissants ({point.rollN} mois)
          </div>
          {row("#737373", "Loyers annualises", fc(point.loyersAnnRoll))}
          {row("#737373", "− Charges annualisees", `−${fc(point.chargesAnnRoll)}`)}
          {row("#737373", "÷ Cout total projet", fc(point.coutTotal))}
          {showBrutRoll && row("#0ea5e9", "→ Rendement brut", fmt(point.rBrutRoll), true)}
          {showNetRoll && row("#16a34a", "→ Rendement net", fmt(point.rNetRoll), true)}
        </>
      )}
      {showCumul && point.rBrutCumul != null && (
        <>
          <div style={{ fontSize: 10, color: "#737373", marginTop: showRoll ? 6 : 0, marginBottom: 2 }}>
            Cumul depuis mise en location ({point.cumulN ?? 0} mois)
          </div>
          {point.loyersAnnCumul != null && row("#737373", "Loyers annualises", fc(point.loyersAnnCumul))}
          {point.chargesAnnCumul != null && row("#737373", "− Charges annualisees", `−${fc(point.chargesAnnCumul)}`)}
          {row("#737373", "÷ Cout total projet", fc(point.coutTotal))}
          {showBrutCumul && row("#7dd3fc", "→ Rendement brut", fmt(point.rBrutCumul), true)}
          {showNetCumul && row("#86efac", "→ Rendement net", fmt(point.rNetCumul), true)}
        </>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function GraphRendementMensuel({ property, incomes, expenses, rentEntries, loan, chargePayments }: Props) {
  // Toggles par courbe.
  const [showBrutRoll, setShowBrutRoll] = useState(true);
  const [showNetRoll, setShowNetRoll] = useState(true);
  const [showBrutCumul, setShowBrutCumul] = useState(true);
  const [showNetCumul, setShowNetCumul] = useState(true);
  // Detail block (replie par defaut).
  const [detailOpen, setDetailOpen] = useState(false);
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
    const loyersAnnRoll = rollLoyers * rollFactor;
    const chargesAnnRoll = rollDepenses * rollFactor;
    const rBrutRoll = (loyersAnnRoll / coutTotal) * 100;
    const rNetRoll = ((loyersAnnRoll - chargesAnnRoll) / coutTotal) * 100;

    // ── Cumul depuis la mise en location ──
    let rBrutCumul: number | null = null;
    let rNetCumul: number | null = null;
    let loyersAnnCumul: number | null = null;
    let chargesAnnCumul: number | null = null;
    let cumulN: number | null = null;
    if (cumulStartIdx >= 0 && i >= cumulStartIdx) {
      const cumulWindow = monthlyEffective.slice(cumulStartIdx, i + 1);
      cumulN = cumulWindow.length;
      const cumulLoyers = cumulWindow.reduce((s, x) => s + x.revenusLoyers + x.revenusAutres, 0);
      const cumulDepenses = cumulWindow.reduce((s, x) => s + x.depenses, 0);
      const cumulFactor = 12 / cumulN;
      loyersAnnCumul = cumulLoyers * cumulFactor;
      chargesAnnCumul = cumulDepenses * cumulFactor;
      rBrutCumul = (loyersAnnCumul / coutTotal) * 100;
      rNetCumul = ((loyersAnnCumul - chargesAnnCumul) / coutTotal) * 100;
    }

    return {
      label: m.label,
      rBrutRoll: Math.round(rBrutRoll * 100) / 100,
      rNetRoll: Math.round(rNetRoll * 100) / 100,
      rBrutCumul: rBrutCumul != null ? Math.round(rBrutCumul * 100) / 100 : null,
      rNetCumul: rNetCumul != null ? Math.round(rNetCumul * 100) / 100 : null,
      // Donnees du calcul (pour l'infobulle detaillee)
      loyersAnnRoll: Math.round(loyersAnnRoll),
      chargesAnnRoll: Math.round(chargesAnnRoll),
      loyersAnnCumul: loyersAnnCumul != null ? Math.round(loyersAnnCumul) : null,
      chargesAnnCumul: chargesAnnCumul != null ? Math.round(chargesAnnCumul) : null,
      rollN,
      cumulN,
      coutTotal: Math.round(coutTotal),
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

  const toggles: { key: "brutRoll" | "netRoll" | "brutCumul" | "netCumul"; label: string; color: string; value: boolean; set: (v: boolean) => void }[] = [
    { key: "brutRoll", label: "Brut 12m", color: "#0ea5e9", value: showBrutRoll, set: setShowBrutRoll },
    { key: "netRoll", label: "Net 12m", color: "#16a34a", value: showNetRoll, set: setShowNetRoll },
    { key: "brutCumul", label: "Brut cumul", color: "#7dd3fc", value: showBrutCumul, set: setShowBrutCumul },
    { key: "netCumul", label: "Net cumul", color: "#86efac", value: showNetCumul, set: setShowNetCumul },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-2 justify-end">
        {toggles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => t.set(!t.value)}
            className="text-[10px] px-2 py-1 rounded border transition-colors"
            style={{
              borderColor: t.value ? `${t.color}80` : undefined,
              backgroundColor: t.value ? `${t.color}1a` : undefined,
              color: t.value ? t.color : undefined,
              borderStyle: t.value ? "solid" : "dashed",
              fontWeight: t.value ? 500 : 400,
            }}
            aria-pressed={t.value}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
              style={{
                backgroundColor: t.value ? t.color : "transparent",
                border: `1px solid ${t.color}`,
              }}
            />
            {t.label}
          </button>
        ))}
      </div>
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
            <Tooltip
              content={(props: object) => <ChartTooltip {...props} showBrutRoll={showBrutRoll} showNetRoll={showNetRoll} showBrutCumul={showBrutCumul} showNetCumul={showNetCumul} />}
              wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
              position={{ y: -100 }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={10} />
            <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
            {showBrutRoll && <Line type="monotone" dataKey="rBrutRoll" name="Brut 12m" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />}
            {showNetRoll && <Line type="monotone" dataKey="rNetRoll" name="Net 12m" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />}
            {showBrutCumul && <Line type="monotone" dataKey="rBrutCumul" name="Brut cumul" stroke="#7dd3fc" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />}
            {showNetCumul && <Line type="monotone" dataKey="rNetCumul" name="Net cumul" stroke="#86efac" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[10px] text-muted-foreground italic leading-relaxed flex-1 min-w-0">
          Base sur les loyers percus et les depenses reelles (paiements trackes de l&apos;onglet Charges inclus).
          {lastRentIdx >= 0 && lastRentIdx < monthlyEffective.length - 1 && (
            <> Affichage jusqu&apos;au dernier mois de loyer percu ({monthlyEffective[lastRentIdx].label}).</>
          )}
        </p>
        <CurvesInfoTooltip />
      </div>

      {/* Detail repliable des donnees du graph */}
      {dataTrim.length > 0 && (() => {
        const lastPoint = dataTrim[dataTrim.length - 1];
        // Sums sur la fenetre glissante 12 mois (= identique au calcul du dernier point)
        const lastIdxEff = Math.min(monthlyEffective.length, dataTrim.length) - 1;
        const rollWin = monthlyEffective.slice(Math.max(0, lastIdxEff - 11), lastIdxEff + 1);
        const sumLoyers12m = rollWin.reduce((s, x) => s + x.revenusLoyers + x.revenusAutres, 0);
        const sumCharges12m = rollWin.reduce((s, x) => s + x.depenses, 0);
        const factor = 12 / Math.max(1, rollWin.length);
        const loyersAnnualises = sumLoyers12m * factor;
        const chargesAnnualisees = sumCharges12m * factor;
        // Cumul depuis premier loyer
        const firstRentIdx = monthlyEffective.findIndex((m) => m.revenusLoyers > 0);
        const cumulWin = firstRentIdx >= 0
          ? monthlyEffective.slice(firstRentIdx, lastIdxEff + 1)
          : [];
        const sumLoyersCumul = cumulWin.reduce((s, x) => s + x.revenusLoyers + x.revenusAutres, 0);
        const sumChargesCumul = cumulWin.reduce((s, x) => s + x.depenses, 0);

        const fc = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
        const fp = (v: number | null) => v == null ? "—" : `${v.toFixed(2)} %`;

        return (
          <div className="mt-3">
            <div className="rounded-md border border-dotted border-muted-foreground/30 transition-colors hover:border-muted-foreground/50">
              <button
                type="button"
                onClick={() => setDetailOpen((v) => !v)}
                className="flex items-center justify-between gap-3 w-full px-3 py-2 hover:bg-muted/40 rounded-md transition-colors text-left cursor-pointer"
                aria-expanded={detailOpen}
              >
                <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded border border-current text-[10px] leading-none transition-transform ${detailOpen ? "rotate-90" : ""}`}>▸</span>
                  Detail du rendement
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">
                    ({detailOpen ? "replier" : "cliquer pour deplier"})
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground/70 font-mono">
                  {dataTrim.length} mois · dernier : {lastPoint.label}
                </span>
              </button>
              {detailOpen && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-dotted border-muted-foreground/20">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground" style={{ color: "#0ea5e9" }}>Brut 12m</dt>
                      <dd className="font-medium tabular-nums">{fp(lastPoint.rBrutRoll)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground" style={{ color: "#16a34a" }}>Net 12m</dt>
                      <dd className="font-medium tabular-nums">{fp(lastPoint.rNetRoll)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground" style={{ color: "#7dd3fc" }}>Brut cumul</dt>
                      <dd className="font-medium tabular-nums">{fp(lastPoint.rBrutCumul)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground" style={{ color: "#86efac" }}>Net cumul</dt>
                      <dd className="font-medium tabular-nums">{fp(lastPoint.rNetCumul)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Loyers 12m (annualises)</dt>
                      <dd className="font-medium tabular-nums">{fc(loyersAnnualises)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Charges 12m (annualisees)</dt>
                      <dd className="font-medium tabular-nums">{fc(chargesAnnualisees)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Cout total projet</dt>
                      <dd className="font-medium tabular-nums">{fc(coutTotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Mois pris en compte</dt>
                      <dd className="font-medium tabular-nums">{rollWin.length} / 12</dd>
                    </div>
                    {firstRentIdx >= 0 && (
                      <>
                        <div className="flex justify-between col-span-2 sm:col-span-3 md:col-span-4 pt-1 mt-1 border-t border-dotted border-muted-foreground/15">
                          <dt className="text-muted-foreground italic">Cumul depuis le 1er loyer percu ({monthlyEffective[firstRentIdx].label})</dt>
                          <dd className="text-muted-foreground italic tabular-nums">{cumulWin.length} mois</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Loyers cumules</dt>
                          <dd className="font-medium tabular-nums">{fc(sumLoyersCumul)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Charges cumulees</dt>
                          <dd className="font-medium tabular-nums">{fc(sumChargesCumul)}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
