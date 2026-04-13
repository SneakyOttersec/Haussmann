"use client";

import { useState } from "react";
import {
  ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const RENDEMENT_CURVE_DEFINITIONS: { label: string; color: string; desc: string }[] = [
  { label: "Brut 12m", color: "#0ea5e9", desc: "Rendement brut sur les 12 derniers mois glissants (loyers percus / cout total, annualise). Reagit aux variations recentes." },
  { label: "Net 12m", color: "#16a34a", desc: "Rendement net 12 mois glissants (loyers − charges). Credit exclu (capture par le cash flow)." },
  { label: "Brut cumul", color: "#7dd3fc", desc: "Rendement brut cumulatif depuis le premier loyer percu, annualise. Plus stable, converge vers le rendement reel observe." },
  { label: "Net cumul", color: "#86efac", desc: "Rendement net cumulatif depuis le premier loyer percu (loyers − charges cumulees). Reference long-terme." },
];

function RendementCurvesInfo() {
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
          {RENDEMENT_CURVE_DEFINITIONS.map((d) => (
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

export interface MonthlyFinance {
  mois: string;
  revenus: number;
  depenses: number;
  credit: number;
  cashFlow: number;
  cumulCashFlow: number;
}

export interface PatrimoineMonth {
  mois: string;
  valeurBiens: number;
  capitalRestantDu: number;
  patrimoineNet: number;
}

export interface RendementMonth {
  mois: string;
  rBrutRoll: number;
  rNetRoll: number;
  rBrutCumul: number | null;
  rNetCumul: number | null;
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(v).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");

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

export function CashFlowChartFinances({ data, seuil }: { data: MonthlyFinance[]; seuil: number }) {
  return (
    <div className="border border-dotted rounded-md p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Flux mensuels depuis l&apos;acquisition</p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 5 }} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
          <Tooltip content={<CashFlowTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
          <Bar dataKey="revenus" stackId="stack" fill="#34d399" name="Revenus" />
          <Bar dataKey="depenses" stackId="stack" fill="#fb923c" name="Charges" />
          <Bar dataKey="credit" stackId="stack" fill="#60a5fa" name="Credit" />
          <Line type="monotone" dataKey="cashFlow" stroke="#991b1b" strokeWidth={2} dot={{ r: 1.5 }} name="Cash flow" />
          <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
          {seuil > 0 && <ReferenceLine y={seuil} stroke="#dc2626" strokeWidth={1} strokeDasharray="4 4" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function RendementTooltip({ active, payload, label, showBrutRoll, showNetRoll, showBrutCumul, showNetCumul }: any) {
  if (!active || !payload?.length) return null;
  const get = (k: string): number | null => {
    const p = payload.find((p: any) => p.dataKey === k);
    return p?.value ?? null;
  };
  const fmt = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)} %`);
  const showRoll = showBrutRoll || showNetRoll;
  const showCumul = showBrutCumul || showNetCumul;
  if (!showRoll && !showCumul) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 11, lineHeight: 1.7, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", minWidth: 240 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {showRoll && (
        <>
          <div style={{ fontSize: 10, color: "#737373", marginBottom: 2 }}>12 mois glissants</div>
          {showBrutRoll && <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#0ea5e9" }}>Brut</span><span style={{ fontWeight: 600 }}>{fmt(get("rBrutRoll"))}</span></div>}
          {showNetRoll && <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#16a34a" }}>Net</span><span style={{ fontWeight: 600 }}>{fmt(get("rNetRoll"))}</span></div>}
        </>
      )}
      {showCumul && (
        <>
          <div style={{ fontSize: 10, color: "#737373", marginTop: showRoll ? 6 : 0, marginBottom: 2 }}>Cumul depuis premier loyer</div>
          {showBrutCumul && <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#7dd3fc" }}>Brut</span><span style={{ fontWeight: 600 }}>{fmt(get("rBrutCumul"))}</span></div>}
          {showNetCumul && <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#86efac" }}>Net</span><span style={{ fontWeight: 600 }}>{fmt(get("rNetCumul"))}</span></div>}
        </>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function RendementChartFinances({ data }: { data: RendementMonth[] }) {
  const [showBrutRoll, setShowBrutRoll] = useState(true);
  const [showNetRoll, setShowNetRoll] = useState(true);
  const [showBrutCumul, setShowBrutCumul] = useState(true);
  const [showNetCumul, setShowNetCumul] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  const toggles: { key: string; label: string; color: string; value: boolean; set: (v: boolean) => void }[] = [
    { key: "brutRoll", label: "Brut 12m", color: "#0ea5e9", value: showBrutRoll, set: setShowBrutRoll },
    { key: "netRoll", label: "Net 12m", color: "#16a34a", value: showNetRoll, set: setShowNetRoll },
    { key: "brutCumul", label: "Brut cumul", color: "#7dd3fc", value: showBrutCumul, set: setShowBrutCumul },
    { key: "netCumul", label: "Net cumul", color: "#86efac", value: showNetCumul, set: setShowNetCumul },
  ];

  return (
    <div className="border border-dotted rounded-md p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Rendement mensuel du portefeuille
        </p>
        <div className="flex flex-wrap gap-1.5">
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
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#e5e5e5" />
          <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(1)} %`}
            domain={["auto", "auto"]}
            width={50}
          />
          <Tooltip
            content={(props: object) => <RendementTooltip {...props} showBrutRoll={showBrutRoll} showNetRoll={showNetRoll} showBrutCumul={showBrutCumul} showNetCumul={showNetCumul} />}
            wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
            position={{ y: -100 }}
          />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconSize={10} />
          <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
          {showBrutRoll && <Line type="monotone" dataKey="rBrutRoll" name="Brut 12m" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 1.5 }} />}
          {showNetRoll && <Line type="monotone" dataKey="rNetRoll" name="Net 12m" stroke="#16a34a" strokeWidth={2} dot={{ r: 1.5 }} />}
          {showBrutCumul && <Line type="monotone" dataKey="rBrutCumul" name="Brut cumul" stroke="#7dd3fc" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />}
          {showNetCumul && <Line type="monotone" dataKey="rNetCumul" name="Net cumul" stroke="#86efac" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[10px] text-muted-foreground italic leading-relaxed flex-1 min-w-0">
          Credit exclu (capture par le cash flow). Loyers percus + charges reelles consolidees sur tous les biens selectionnes.
        </p>
        <RendementCurvesInfo />
      </div>

      {/* Detail repliable des donnees du graph */}
      {data.length > 0 && (() => {
        const lastPoint = data[data.length - 1];
        // Premier mois avec rendement cumul defini = 1er loyer percu
        const firstCumulIdx = data.findIndex((d) => d.rBrutCumul != null);
        const cumulCount = firstCumulIdx >= 0 ? data.length - firstCumulIdx : 0;
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
                  {data.length} mois · dernier : {lastPoint.mois}
                </span>
              </button>
              {detailOpen && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-dotted border-muted-foreground/20">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <dt style={{ color: "#0ea5e9" }}>Brut 12m</dt>
                      <dd className="font-medium tabular-nums">{fp(lastPoint.rBrutRoll)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt style={{ color: "#16a34a" }}>Net 12m</dt>
                      <dd className="font-medium tabular-nums">{fp(lastPoint.rNetRoll)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt style={{ color: "#7dd3fc" }}>Brut cumul</dt>
                      <dd className="font-medium tabular-nums">{fp(lastPoint.rBrutCumul)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt style={{ color: "#86efac" }}>Net cumul</dt>
                      <dd className="font-medium tabular-nums">{fp(lastPoint.rNetCumul)}</dd>
                    </div>
                    <div className="flex justify-between col-span-2 sm:col-span-3 md:col-span-4 pt-1 mt-1 border-t border-dotted border-muted-foreground/15">
                      <dt className="text-muted-foreground italic">Periode couverte</dt>
                      <dd className="text-muted-foreground italic tabular-nums">
                        {data.length} mois · cumul depuis 1er loyer ({cumulCount} mois)
                      </dd>
                    </div>
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

export function PatrimoineChart({
  data,
  projectionYears,
  onProjectionChange,
}: {
  data: PatrimoineMonth[];
  projectionYears: number;
  onProjectionChange: (y: number) => void;
}) {
  return (
    <div className="border border-dotted rounded-md p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Patrimoine net (depuis l&apos;acquisition, projection {projectionYears} ans)
        </p>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">Projection :</span>
          {[3, 5, 10, 15, 20].map((y) => (
            <button
              key={y}
              onClick={() => onProjectionChange(y)}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                projectionYears === y
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}a
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="mois" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={30} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} domain={[0, "auto"]} />
          <Tooltip formatter={(value) => [fmtEur(Number(value))]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          <Line type="monotone" dataKey="valeurBiens" stroke="#34d399" strokeWidth={1.5} dot={false} name="Valeur biens" />
          <Line type="monotone" dataKey="capitalRestantDu" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Capital restant du" />
          <Line type="monotone" dataKey="patrimoineNet" stroke="oklch(0.52 0.07 175)" strokeWidth={2.5} dot={{ r: 2 }} name="Patrimoine net" />
          <ReferenceLine
            x={new Date().toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}
            stroke="#999"
            strokeDasharray="4 4"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
