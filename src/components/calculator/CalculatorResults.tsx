"use client";

import { useState, useMemo } from "react";
import type { CalculatorResults as Results } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { calculerTRI } from "@/lib/calculations/irr";

interface CalculatorResultsProps {
  results: Results;
}

function eur(v: number): string {
  return formatCurrency(v);
}

interface KpiTooltip {
  formula: string;
  applied: string;
}

function Kpi({ label, value, accent, tooltip }: {
  label: string; value: string; accent?: "positive" | "negative"; tooltip?: KpiTooltip;
}) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="text-center relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 cursor-help">{label}</p>
      <p className={`text-lg font-bold leading-tight ${
        accent === "positive" ? "text-green-600" : accent === "negative" ? "text-destructive" : ""
      }`}>
        {value}
      </p>
      {tooltip && show && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-white border border-dotted rounded-lg shadow-lg p-3 text-left">
          <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Formule</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{tooltip.formula}</p>
          <hr className="my-2 border-dashed border-muted-foreground/20" />
          <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Calcul applique</p>
          <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-line font-mono">{tooltip.applied}</p>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${color ?? ""}`}>{value}</span>
    </div>
  );
}

export function CalculatorResultsPanel({ results }: CalculatorResultsProps) {
  const cfSign = results.cashFlowMensuelApresImpot >= 0 ? "positive" : "negative";
  const r = results;
  const [triAnnee, setTriAnnee] = useState(10);
  const [showTriTooltip, setShowTriTooltip] = useState(false);

  const triCustom = useMemo(() => {
    const n = Math.min(triAnnee, r.projection.length);
    if (n < 1) return 0;
    const cfs: number[] = [-r.apportPersonnel];
    for (let i = 0; i < n; i++) {
      const p = r.projection[i];
      if (i < n - 1) {
        cfs.push(p.cashFlowApresImpot);
      } else {
        cfs.push(p.cashFlowApresImpot + p.valeurBien - p.capitalRestantDu);
      }
    }
    return calculerTRI(cfs);
  }, [r, triAnnee]);

  // Compute net-net at different time points
  const netNetAt = (yr: number) => {
    const p = r.projection[yr - 1];
    if (!p) return 0;
    return r.coutTotalAcquisition > 0
      ? ((p.loyerNet - p.charges - p.impot) / r.coutTotalAcquisition) * 100
      : 0;
  };
  const nn1 = netNetAt(1);
  const nn10 = netNetAt(Math.min(10, r.projection.length));
  const nn21 = netNetAt(Math.min(21, r.projection.length));

  const tooltips: Record<string, KpiTooltip> = {
    rdtBrut: {
      formula: "Loyer annuel brut\n/ Cout total d'acquisition\n× 100",
      applied: `${eur(r.loyerAnnuelBrut)}\n/ ${eur(r.coutTotalAcquisition)}\n= ${formatPercent(r.rendementBrut)}`,
    },
    rdtNet: {
      formula: "(Loyer annuel net - Charges annuelles)\n/ Cout total d'acquisition\n× 100",
      applied: `(${eur(r.loyerAnnuelNet)} - ${eur(r.chargesAnnuellesTotales)})\n/ ${eur(r.coutTotalAcquisition)}\n= ${eur(r.loyerAnnuelNet - r.chargesAnnuellesTotales)} / ${eur(r.coutTotalAcquisition)}\n= ${formatPercent(r.rendementNet)}`,
    },
    rdtNetNet: {
      formula: "(Loyer net - Charges - Impots)\n/ Cout total d'acquisition × 100\n\nEvolue dans le temps car l'impot\nchange avec les interets d'emprunt.",
      applied: `A1:  ${formatPercent(nn1)}${r.projection[0]?.impot === 0 ? " (pas d'impot)" : ""}\nA${Math.min(10, r.projection.length)}: ${formatPercent(nn10)}\nA${Math.min(21, r.projection.length)}: ${formatPercent(nn21)}`,
    },
    cashFlow: {
      formula: "(Loyer net - Credit - Charges - Impots)\n/ 12",
      applied: `(${eur(r.loyerAnnuelNet)} - ${eur(r.mensualiteCredit * 12)} - ${eur(r.chargesAnnuellesTotales)} - ${eur(r.impotAnnuel)})\n/ 12\n= ${eur(r.cashFlowAnnuelApresImpot)} / 12\n= ${formatCurrency(r.cashFlowMensuelApresImpot)}/mois`,
    },
    taeg: {
      formula: "Taux annuel effectif global\n= Taux nominal + cout assurance\ncalcule par methode actuarielle\n(Newton-Raphson)",
      applied: `Mensualite totale: ${formatCurrency(r.mensualiteCredit, true)}/mois\nTAEG = ${formatPercent(r.taeg)}`,
    },
    tri: {
      formula: `TRI a ${triAnnee} ans (avec levier)\nCF0 = -apport personnel\nCF1..${triAnnee - 1} = cash flow annuel apres impot\nCF${triAnnee} = CF + valeur bien - capital restant du`,
      applied: `Apport: ${eur(r.apportPersonnel)}\nCF an 1: ${eur(r.projection[0]?.cashFlowApresImpot ?? 0)}\nValeur bien A${triAnnee}: ${eur(r.projection[triAnnee - 1]?.valeurBien ?? 0)}\nCRD A${triAnnee}: ${eur(r.projection[triAnnee - 1]?.capitalRestantDu ?? 0)}\nTRI ${triAnnee} ans = ${formatPercent(triCustom)}`,
    },
  };

  return (
    <div className="space-y-5">
      {/* KPI band */}
      <div className="border border-dotted rounded-lg p-5">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          <Kpi label="Rdt brut" value={formatPercent(r.rendementBrut)} tooltip={tooltips.rdtBrut} />
          <Kpi label="Rdt net" value={formatPercent(r.rendementNet)} tooltip={tooltips.rdtNet} />
          <Kpi label="Rdt net-net A1" value={formatPercent(nn1)} tooltip={tooltips.rdtNetNet} />
          <Kpi label="Cash flow/m" value={formatCurrency(r.cashFlowMensuelApresImpot)} accent={cfSign} tooltip={tooltips.cashFlow} />
          <Kpi label="TAEG" value={formatPercent(r.taeg)} tooltip={tooltips.taeg} />
          <div className="text-center relative"
            onMouseEnter={() => setShowTriTooltip(true)}
            onMouseLeave={() => setShowTriTooltip(false)}
          >
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-help">TRI</p>
              <select
                value={triAnnee}
                onChange={(e) => setTriAnnee(Number(e.target.value))}
                className="text-[10px] bg-transparent text-muted-foreground outline-none cursor-pointer"
              >
                {[5, 10, 15, 20, 25].filter((y) => y <= r.projection.length).map((y) => (
                  <option key={y} value={y}>{y} ans</option>
                ))}
              </select>
            </div>
            <p className={`text-lg font-bold leading-tight ${triCustom > 0 ? "text-green-600" : "text-destructive"}`}>
              {formatPercent(triCustom)}
            </p>
            {showTriTooltip && tooltips.tri && (
              <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-white border border-dotted rounded-lg shadow-lg p-3 text-left">
                <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Formule</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{tooltips.tri.formula}</p>
                <hr className="my-2 border-dashed border-muted-foreground/20" />
                <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Calcul applique</p>
                <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-line font-mono">{tooltips.tri.applied}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail breakdown */}
      <div className="border border-dotted rounded-lg p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3">Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <DetailRow label="Cout total acquisition" value={formatCurrency(r.coutTotalAcquisition)} />
            <DetailRow label="Apport personnel" value={formatCurrency(r.apportPersonnel)} />
            <DetailRow label="Loyer annuel brut" value={formatCurrency(r.loyerAnnuelBrut)} />
            <DetailRow label="Loyer annuel net (vacance)" value={formatCurrency(r.loyerAnnuelNet)} />
            <DetailRow label="Charges annuelles" value={formatCurrency(r.chargesAnnuellesTotales)} />
          </div>
          <div>
            <DetailRow label="Mensualite (credit + assurance)" value={formatCurrency(r.mensualiteCredit, true)} />
            <DetailRow label="Cash flow mensuel avant impot" value={formatCurrency(r.cashFlowMensuelAvantImpot)} />
            <DetailRow label="Impot annuel estime" value={formatCurrency(r.impotAnnuel)} />
            <DetailRow label="Cash flow annuel apres impot" value={formatCurrency(r.cashFlowAnnuelApresImpot)} color={r.cashFlowAnnuelApresImpot >= 0 ? "text-green-600" : "text-destructive"} />
          </div>
        </div>
      </div>
    </div>
  );
}
