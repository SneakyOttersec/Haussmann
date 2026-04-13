"use client";

import {
  ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

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
function RendementTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const get = (k: string): number | null => {
    const p = payload.find((p: any) => p.dataKey === k);
    return p?.value ?? null;
  };
  const fmt = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)} %`);
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 11, lineHeight: 1.7, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", minWidth: 240 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 10, color: "#737373", marginBottom: 2 }}>12 mois glissants</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#0ea5e9" }}>Brut</span><span style={{ fontWeight: 600 }}>{fmt(get("rBrutRoll"))}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#16a34a" }}>Net</span><span style={{ fontWeight: 600 }}>{fmt(get("rNetRoll"))}</span></div>
      <div style={{ fontSize: 10, color: "#737373", marginTop: 6, marginBottom: 2 }}>Cumul depuis premier loyer</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#7dd3fc" }}>Brut</span><span style={{ fontWeight: 600 }}>{fmt(get("rBrutCumul"))}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}><span style={{ color: "#86efac" }}>Net</span><span style={{ fontWeight: 600 }}>{fmt(get("rNetCumul"))}</span></div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function RendementChartFinances({ data }: { data: RendementMonth[] }) {
  return (
    <div className="border border-dotted rounded-md p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        Rendement mensuel du portefeuille (valeurs reelles)
      </p>
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
          <Tooltip content={<RendementTooltip />} wrapperStyle={{ zIndex: 50 }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconSize={10} />
          <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
          <Line type="monotone" dataKey="rBrutRoll" name="Brut 12m" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 1.5 }} />
          <Line type="monotone" dataKey="rNetRoll" name="Net 12m" stroke="#16a34a" strokeWidth={2} dot={{ r: 1.5 }} />
          <Line type="monotone" dataKey="rBrutCumul" name="Brut cumul" stroke="#7dd3fc" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="rNetCumul" name="Net cumul" stroke="#86efac" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground mt-2 italic leading-relaxed">
        Pleines : fenetre glissante 12 mois. Pointillees : cumul depuis le premier loyer percu. Credit exclu (capture par le cash flow).
      </p>
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
