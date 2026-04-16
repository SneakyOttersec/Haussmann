"use client";

import { useState } from "react";
import type { ProjectionAnnuelle, EntreesCalculateur, ResultatsCalculateur, CleEvolution } from "@/types";
import { formatCurrency } from "@/lib/utils";
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
  Label as RLabel,
} from "recharts";

interface ResultsChartProps {
  projection: ProjectionAnnuelle[];
  inputs: EntreesCalculateur;
  results: ResultatsCalculateur;
  onUpdateEvolutions: (evolutions: EntreesCalculateur["evolutions"]) => void;
}

interface TableRow {
  label: string;
  values: number[];
  bold?: boolean;
  separator?: boolean;
  evoKey?: CleEvolution;
}

function evolve(base: number, rate: number, years: number): number[] {
  return Array.from({ length: years }, (_, i) => base * Math.pow(1 + rate, i));
}

function evoRate(inputs: EntreesCalculateur, key: CleEvolution): number {
  return inputs.evolutions?.[key] ?? 0;
}

function buildTableRows(inputs: EntreesCalculateur, results: ResultatsCalculateur): TableRow[] {
  const p = results.projection;
  if (p.length === 0) return [];

  const lotsCount = inputs.lots?.length || 1;
  const comptaParLot = 80;

  // Individual charge lines (evolved) — recompute from base + evo for the breakdown
  const r = (key: CleEvolution) => evoRate(inputs, key);
  const baseGestion = results.loyerAnnuelNet * inputs.gestionLocativePct;
  const baseCompta = inputs.comptabilite;

  const ev = (base: number, key: CleEvolution) => p.map((_, i) => base * Math.pow(1 + r(key), i));

  const assurancePNO = ev(inputs.assurancePNO, "assurancePNO");
  const gestionLoc = ev(baseGestion, "gestionLocative");
  const gli = ev(inputs.gli, "gli");
  const taxeFonciere = ev(inputs.taxeFonciere, "taxeFonciere");
  const comptabilite = ev(baseCompta, "comptabilite");
  const entretien = ev(inputs.entretien, "entretien");
  const cfeCrl = ev(inputs.cfeCrl, "cfeCrl");
  const copro = ev(inputs.chargesCopro, "chargesCopro");
  const autresCharges = ev(inputs.autresChargesAnnuelles, "autresCharges");

  const rows: TableRow[] = [
    { label: "Revenus locatifs bruts", values: p.map((y) => y.loyerBrut), evoKey: "lopiloyer" },
    { label: "Vacance locative", values: p.map((y) => -(y.loyerBrut - y.loyerNet)) },
    { label: "Revenus locatifs nets", values: p.map((y) => y.loyerNet), bold: true },
    { label: "", values: [], separator: true },
    { label: "Assurance PNO", values: assurancePNO.map((v) => -v), evoKey: "assurancePNO" },
    { label: "Gestion locative", values: gestionLoc.map((v) => -v), evoKey: "gestionLocative" },
    { label: "GLI", values: gli.map((v) => -v), evoKey: "gli" },
    { label: "Taxe fonciere", values: taxeFonciere.map((v) => -v), evoKey: "taxeFonciere" },
    { label: `Comptabilite (+${comptaParLot} EUR/lot)`, values: comptabilite.map((v) => -v), evoKey: "comptabilite" },
    { label: "Entretien", values: entretien.map((v) => -v), evoKey: "entretien" },
    { label: "CFE / CRL", values: cfeCrl.map((v) => -v), evoKey: "cfeCrl" },
    { label: "Copropriete", values: copro.map((v) => -v), evoKey: "chargesCopro" },
    { label: "Autres charges", values: autresCharges.map((v) => -v), evoKey: "autresCharges" },
    { label: "Total charges", values: p.map((y) => -y.charges), bold: true },
    { label: "", values: [], separator: true },
    { label: "Interets emprunt", values: p.map((y) => -y.interets) },
    { label: "Capital rembourse", values: p.map((y) => -y.capitalRembourse) },
    { label: "Remboursement emprunt", values: p.map((y) => -y.mensualitesCredit), bold: true },
    { label: "Capital restant du", values: p.map((y) => y.capitalRestantDu) },
    { label: "", values: [], separator: true },
    { label: "Tresorerie nette annuelle avant impots", values: p.map((y) => y.cashFlowAvantImpot), bold: true },
    { label: "Cash flow mensuel avant impots", values: p.map((y) => y.cashFlowAvantImpot / 12), bold: true },
    { label: "", values: [], separator: true },
    { label: "Impots", values: p.map((y) => -y.impot) },
    { label: "Cash flow annuel apres impots", values: p.map((y) => y.cashFlowApresImpot), bold: true },
    { label: "", values: [], separator: true },
    { label: "Valeur du bien", values: p.map((y) => y.valeurBien) },
    { label: "Plus-value latente", values: p.map((y) => y.plusValue) },
  ];

  return rows;
}

/* ── Milestones ── */

interface Milestone {
  annee: string;
  label: string;
  color: string;
}

function computeMilestones(projection: ProjectionAnnuelle[], inputs: EntreesCalculateur): Milestone[] {
  const milestones: Milestone[] = [];

  // Annee d'autofinancement: first year cash flow after tax >= 0
  const autofinIdx = projection.findIndex((p) => p.cashFlowApresImpot >= 0);
  if (autofinIdx >= 0) {
    milestones.push({ annee: `A${projection[autofinIdx].annee}`, label: "Autofinancement", color: "#16a34a" });
  }

  // Fin du credit: first year capital restant ~ 0 (tolerance for floating point)
  const finCreditIdx = projection.findIndex((p) => p.capitalRestantDu < 1);
  if (finCreditIdx >= 0 && finCreditIdx < projection.length - 1) {
    milestones.push({ annee: `A${projection[finCreditIdx].annee}`, label: "Fin du credit", color: "oklch(0.52 0.07 175)" });
  }

  // Cumulated cash flow break-even (cumul CF apres impot >= apport initial)
  const apport = (inputs.prixAchat * (1 + inputs.fraisNotairePct) + inputs.fraisAgence + inputs.montantTravaux) - inputs.montantEmprunte;
  let cumul = 0;
  for (let i = 0; i < projection.length; i++) {
    cumul += projection[i].cashFlowApresImpot;
    if (cumul >= apport && apport > 0) {
      milestones.push({ annee: `A${projection[i].annee}`, label: "Apport rembourse", color: "#ca8a04" });
      break;
    }
  }

  return milestones;
}

/* ── Currency formatter for tooltips ── */
const fmtEur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");

/* eslint-disable @typescript-eslint/no-explicit-any */
function FluxTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const get = (key: string) => {
    const entry = payload.find((p: any) => p.dataKey === key);
    return entry?.value ?? 0;
  };
  const revenus = get("Revenus nets");
  const charges = get("Charges");
  const credit = get("Credit");
  const impots = get("Impots");
  const cashFlow = get("Cash flow");

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 12px", fontSize: 11, lineHeight: 1.7, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#34d399" }}>Revenus nets</span>
        <span style={{ fontWeight: 600 }}>{fmtEur(revenus)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#fb923c" }}>Charges</span>
        <span>{fmtEur(charges)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#60a5fa" }}>Credit</span>
        <span>{fmtEur(credit)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ color: "#f87171" }}>Impots</span>
        <span>{fmtEur(impots)}</span>
      </div>
      <div style={{ borderTop: "1px dashed #ccc", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ fontWeight: 700, color: "#991b1b" }}>Cash flow</span>
        <span style={{ fontWeight: 700, color: cashFlow >= 0 ? "#16a34a" : "#991b1b" }}>{fmtEur(cashFlow)}</span>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function GraphResultats({ projection, inputs, results, onUpdateEvolutions }: ResultsChartProps) {
  const [showTable, setShowTable] = useState(true);
  const [editingEvo, setEditingEvo] = useState<CleEvolution | null>(null);
  const [fluxYears, setFluxYears] = useState(25);
  const [patrimoineYears, setPatrimoineYears] = useState(25);

  if (projection.length === 0) return null;

  const milestones = computeMilestones(projection, inputs);

  const apport = results.apportPersonnel;

  // Build chart data
  let cumulCF = 0;
  const chartData = projection.map((p) => {
    const revenus = Math.round(p.loyerNet);
    const charges = Math.round(p.charges);
    const credit = Math.round(p.mensualitesCredit);
    const impots = Math.round(p.impot);
    const patrimoineNet = Math.round(p.valeurBien - p.capitalRestantDu);
    cumulCF += p.cashFlowApresImpot;
    const enrichissement = Math.round(patrimoineNet - apport + cumulCF);

    return {
      annee: `A${p.annee}`,
      "Revenus nets": revenus,
      "Charges": -charges,
      "Credit": -credit,
      "Impots": -impots,
      "Cash flow": Math.round(p.cashFlowApresImpot),
      "Valeur du bien": Math.round(p.valeurBien),
      "Capital restant du": Math.round(p.capitalRestantDu),
      "Patrimoine net": patrimoineNet,
      "Enrichissement net": enrichissement,
    };
  });

  // Summary badges
  const lastYear = projection[projection.length - 1];
  const patrimoineNetFinal = lastYear.valeurBien - lastYear.capitalRestantDu;
  let cumulCashFlow = 0;
  projection.forEach((p) => { cumulCashFlow += p.cashFlowApresImpot; });

  const tableRows = buildTableRows(inputs, results);

  return (
    <div className="space-y-4">
      <h2>Projection</h2>

      {/* Milestone badges */}
      <div className="flex flex-wrap gap-2">
        {milestones.map((m) => (
          <span key={m.label} className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-[11px]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
            <span className="font-medium">{m.label}</span>
            <span className="text-muted-foreground">{m.annee}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-[11px]">
          <span className="font-medium">Patrimoine net A{lastYear.annee}</span>
          <span className="text-primary font-bold">{fmtEur(patrimoineNetFinal)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-[11px]">
          <span className="font-medium">Cash flow cumule</span>
          <span className={`font-bold ${cumulCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>{fmtEur(cumulCashFlow)}</span>
        </span>
      </div>

      {/* Chart 1: Flux annuels */}
      <div className="border border-dotted rounded-md p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Flux annuels</p>
          <div className="flex items-center gap-1">
            {[10, 20, 25].filter((y) => y <= projection.length).map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setFluxYears(y)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  fluxYears === y
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {y} ans
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData.slice(0, fluxYears)} margin={{ top: 30, right: 10, left: 5, bottom: 5 }} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="annee" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<FluxTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />

            <Bar dataKey="Revenus nets" stackId="stack" fill="#34d399" />
            <Bar dataKey="Charges" stackId="stack" fill="#fb923c" />
            <Bar dataKey="Credit" stackId="stack" fill="#60a5fa" />
            <Bar dataKey="Impots" stackId="stack" fill="#f87171" />

            <Line type="monotone" dataKey="Cash flow" stroke="#991b1b" strokeWidth={2.5} dot={{ r: 2, fill: "#991b1b" }} />

            <ReferenceLine y={0} stroke="#999" strokeWidth={1} />

            {milestones.map((m) => (
              <ReferenceLine key={m.label} x={m.annee} stroke={m.color} strokeWidth={1.5} strokeDasharray="4 4">
                <RLabel value={m.label} position="top" fill={m.color} fontSize={9} fontWeight="bold" offset={6} />
              </ReferenceLine>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Patrimoine */}
      <div className="border border-dotted rounded-md p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Patrimoine</p>
          <div className="flex items-center gap-1">
            {[10, 20, 25].filter((y) => y <= projection.length).map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setPatrimoineYears(y)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  patrimoineYears === y
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {y} ans
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData.slice(0, patrimoineYears)} margin={{ top: 30, right: 10, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="annee" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value, name) => [fmtEur(Number(value)), String(name)]}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />

            <Line type="monotone" dataKey="Valeur du bien" stroke="#34d399" strokeWidth={1.5} dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="Capital restant du" stroke="#60a5fa" strokeWidth={1.5} dot={false} opacity={0.6} />
            <Line type="monotone" dataKey="Patrimoine net" stroke="oklch(0.52 0.07 175)" strokeWidth={2.5} dot={{ r: 2, fill: "oklch(0.52 0.07 175)" }} />
            <Line type="monotone" dataKey="Enrichissement net" stroke="#991b1b" strokeWidth={2} dot={false} strokeDasharray="6 3" />

            {/* Apport line */}
            {apport > 0 && (
              <ReferenceLine y={apport} stroke="#ca8a04" strokeWidth={1} strokeDasharray="4 4">
                <RLabel value={`Apport ${fmtEur(apport)}`} position="insideTopLeft" fill="#ca8a04" fontSize={9} fontWeight="bold" />
              </ReferenceLine>
            )}

            {milestones.filter((m) => m.label === "Fin du credit").map((m) => (
              <ReferenceLine key={m.label} x={m.annee} stroke={m.color} strokeWidth={1.5} strokeDasharray="4 4">
                <RLabel value={m.label} position="insideTopRight" fill={m.color} fontSize={9} fontWeight="bold" />
              </ReferenceLine>
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Table toggle */}
      <button
        type="button"
        onClick={() => setShowTable(!showTable)}
        className="text-xs text-primary hover:underline"
      >
        {showTable ? "Masquer le tableau detaille" : "Afficher le tableau detaille"}
      </button>

      {/* Detailed table */}
      {showTable && (
        <div className="border border-dotted rounded-md overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-dashed border-muted-foreground/20">
                <th className="text-left py-2 px-3 font-bold text-muted-foreground sticky left-0 bg-background min-w-[220px]">
                  Annee
                </th>
                <th className="text-center py-2 px-1 font-bold text-muted-foreground min-w-[50px]">
                  %/an
                </th>
                {projection.map((p) => (
                  <th key={p.annee} className="text-right py-2 px-2 font-bold text-muted-foreground min-w-[80px]">
                    A{p.annee}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                if (row.separator) {
                  return (
                    <tr key={i}>
                      <td colSpan={projection.length + 2} className="py-1">
                        <hr className="border-dashed border-muted-foreground/15" />
                      </td>
                    </tr>
                  );
                }

                const currentEvo = row.evoKey ? (inputs.evolutions?.[row.evoKey] ?? 0) : 0;
                const hasEvo = row.evoKey && currentEvo !== 0;

                return (
                  <tr
                    key={i}
                    className={`${row.bold ? "bg-muted/30" : "hover:bg-muted/20"} transition-colors`}
                  >
                    <td className={`py-1.5 px-3 sticky left-0 bg-background ${row.bold ? "font-bold text-foreground bg-muted/30" : "text-muted-foreground"}`}>
                      <span className="flex items-center gap-1">
                        {row.label}
                        {hasEvo && (
                          <span className="text-[9px] text-primary font-normal">
                            +{(currentEvo * 100).toFixed(1)}%/an
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 px-1 text-center">
                      {row.evoKey && (
                        editingEvo === row.evoKey ? (
                          <input
                            type="number"
                            step="0.1"
                            autoFocus
                            defaultValue={currentEvo ? (currentEvo * 100).toFixed(1) : ""}
                            placeholder="0"
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const newEvos = { ...inputs.evolutions, [row.evoKey!]: val / 100 };
                              if (val === 0) delete newEvos[row.evoKey!];
                              onUpdateEvolutions(newEvos);
                              setEditingEvo(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setEditingEvo(null);
                            }}
                            className="w-10 h-5 text-[10px] text-center border border-input rounded bg-transparent outline-none focus:border-ring"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingEvo(row.evoKey!)}
                            className={`w-10 h-5 text-[10px] rounded transition-colors ${
                              hasEvo
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
                            }`}
                            title="Definir l'augmentation annuelle"
                          >
                            {hasEvo ? `+${(currentEvo * 100).toFixed(1)}%` : "—"}
                          </button>
                        )
                      )}
                    </td>
                    {row.values.map((v, j) => (
                      <td
                        key={j}
                        className={`py-1.5 px-2 text-right tabular-nums ${
                          row.bold ? "font-bold" : ""
                        } ${v < 0 ? "text-destructive" : ""}`}
                      >
                        {formatCurrency(Math.round(v))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
