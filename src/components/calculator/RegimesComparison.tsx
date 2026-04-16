"use client";

import { useMemo, useState } from "react";
import type { EntreesCalculateur, RegimeFiscalDetaille } from "@/types";
import { REGIME_FISCAL_DETAILLE_SHORT, REGIME_FISCAL_DETAILLE_LABELS, versRegimeFiscalDetaille } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { computeYearlyFinancials } from "@/lib/calculations";
import { comparerRegimes, type RegimeComparison } from "@/lib/calculations/regimes";

interface Props {
  inputs: EntreesCalculateur;
}

const HORIZONS = [5, 10, 15, 20, 25];

// Fixed column order (LMNP always leftmost)
const REGIME_ORDER: RegimeFiscalDetaille[] = ['lmnp_reel', 'lmnp_micro', 'ir_reel', 'ir_micro', 'is'];

// Regimes visible by default
const DEFAULT_VISIBLE: RegimeFiscalDetaille[] = ['ir_reel', 'ir_micro', 'is'];

function Cell({
  value,
  best,
  format,
  invert,
  dim,
}: {
  value: number;
  best: boolean;
  format: "eur" | "pct";
  invert?: boolean;
  dim?: boolean;
}) {
  const formatted = format === "eur" ? formatCurrency(value) : formatPercent(value);
  const color = invert
    ? value < 0 ? "text-destructive" : ""
    : value >= 0 ? "" : "text-destructive";
  return (
    <td
      className={`py-1.5 px-3 text-right tabular-nums ${color} ${best ? "font-bold text-green-600" : ""} ${dim ? "opacity-40" : ""}`}
    >
      {formatted}
    </td>
  );
}

function pickBest(
  comparisons: RegimeComparison[],
  key: keyof Pick<RegimeComparison, "impotCumuleHorizon" | "cashFlowCumuleHorizonApresImpot" | "triInvestisseur" | "patrimoineNetApresVente">,
  direction: "min" | "max",
): RegimeFiscalDetaille | null {
  const applicable = comparisons.filter((c) => c.applicability.applicable);
  if (applicable.length === 0) return null;
  const sorted = [...applicable].sort((a, b) =>
    direction === "min" ? a[key] - b[key] : b[key] - a[key]
  );
  return sorted[0].regime;
}

export function RegimesComparison({ inputs }: Props) {
  const [horizon, setHorizon] = useState(10);
  const [visible, setVisible] = useState<Set<RegimeFiscalDetaille>>(new Set(DEFAULT_VISIBLE));
  const currentRegime = versRegimeFiscalDetaille(inputs.regimeFiscal);

  const allComparisons = useMemo(() => {
    const fin = computeYearlyFinancials(inputs);
    const raw = comparerRegimes(inputs, fin.fraisNotaire, fin.years, {
      horizon,
      apportPersonnel: fin.apportPersonnel,
    });
    // Reorder to match fixed column order
    const byRegime = new Map(raw.map((c) => [c.regime, c]));
    return REGIME_ORDER.map((r) => byRegime.get(r)!).filter(Boolean);
  }, [inputs, horizon]);

  const comparisons = useMemo(
    () => allComparisons.filter((c) => visible.has(c.regime)),
    [allComparisons, visible],
  );

  const bestImpot = pickBest(comparisons, "impotCumuleHorizon", "min");
  const bestCF = pickBest(comparisons, "cashFlowCumuleHorizonApresImpot", "max");
  const bestTRI = pickBest(comparisons, "triInvestisseur", "max");
  const bestPatrimoine = pickBest(comparisons, "patrimoineNetApresVente", "max");

  const recommande = bestPatrimoine;

  const toggleRegime = (r: RegimeFiscalDetaille) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(r)) {
        // Prevent hiding the last one
        if (next.size > 1) next.delete(r);
      } else {
        next.add(r);
      }
      return next;
    });
  };

  return (
    <div className="border border-dotted rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider">Comparaison fiscale</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Projection sous chaque regime fiscal avec les memes revenus et charges.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground">Horizon</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="text-xs h-8 rounded-md border border-input bg-transparent px-2 outline-none focus-visible:border-ring"
          >
            {HORIZONS.map((y) => (
              <option key={y} value={y}>
                {y} ans
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Regime toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Regimes :</span>
        {REGIME_ORDER.map((r) => {
          const isVisible = visible.has(r);
          return (
            <button
              key={r}
              type="button"
              onClick={() => toggleRegime(r)}
              className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                isVisible
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-muted-foreground/60"
              }`}
            >
              {REGIME_FISCAL_DETAILLE_SHORT[r]}
            </button>
          );
        })}
      </div>

      {/* Recommandation */}
      {recommande && (
        <div className="border border-dashed border-green-600/30 bg-green-600/5 rounded-md px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            <span className="text-green-600 font-semibold">Meilleur regime a {horizon} ans :</span>{" "}
            <span className="font-bold text-foreground">{REGIME_FISCAL_DETAILLE_LABELS[recommande]}</span>
            {recommande === currentRegime && (
              <span className="ml-2 text-[10px] text-muted-foreground">(regime actuel)</span>
            )}
          </p>
        </div>
      )}

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-muted-foreground/20">
              <th className="text-left py-2 pr-4 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Critere
              </th>
              {comparisons.map((c) => {
                const isCurrent = c.regime === currentRegime;
                return (
                  <th
                    key={c.regime}
                    className={`text-right py-2 px-3 font-medium text-xs ${
                      !c.applicability.applicable ? "opacity-40" : ""
                    } ${isCurrent ? "bg-primary/5" : ""}`}
                    title={!c.applicability.applicable ? c.applicability.reason : undefined}
                  >
                    {REGIME_FISCAL_DETAILLE_SHORT[c.regime]}
                    {isCurrent && <span className="block text-[9px] text-primary font-normal">(actuel)</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-dashed border-muted-foreground/10">
              <td className="py-1.5 pr-4 text-muted-foreground text-xs">Impot annee 1</td>
              {comparisons.map((c) => (
                <Cell
                  key={c.regime}
                  value={c.impotAn1}
                  best={false}
                  format="eur"
                  dim={!c.applicability.applicable}
                />
              ))}
            </tr>
            <tr className="border-b border-dashed border-muted-foreground/10">
              <td className="py-1.5 pr-4 text-muted-foreground text-xs">Impot cumule {horizon} ans</td>
              {comparisons.map((c) => (
                <Cell
                  key={c.regime}
                  value={c.impotCumuleHorizon}
                  best={bestImpot === c.regime}
                  format="eur"
                  dim={!c.applicability.applicable}
                />
              ))}
            </tr>
            <tr className="border-b border-dashed border-muted-foreground/10">
              <td className="py-1.5 pr-4 text-muted-foreground text-xs">CF annee 1 apres impot</td>
              {comparisons.map((c) => (
                <Cell
                  key={c.regime}
                  value={c.cashFlowAn1ApresImpot}
                  best={false}
                  format="eur"
                  invert
                  dim={!c.applicability.applicable}
                />
              ))}
            </tr>
            <tr className="border-b border-dashed border-muted-foreground/10">
              <td className="py-1.5 pr-4 text-muted-foreground text-xs">CF cumule {horizon} ans</td>
              {comparisons.map((c) => (
                <Cell
                  key={c.regime}
                  value={c.cashFlowCumuleHorizonApresImpot}
                  best={bestCF === c.regime}
                  format="eur"
                  invert
                  dim={!c.applicability.applicable}
                />
              ))}
            </tr>
            <tr className="border-b border-dashed border-muted-foreground/10">
              <td className="py-1.5 pr-4 text-muted-foreground text-xs">TRI investisseur {horizon} ans</td>
              {comparisons.map((c) => (
                <Cell
                  key={c.regime}
                  value={c.triInvestisseur}
                  best={bestTRI === c.regime}
                  format="pct"
                  dim={!c.applicability.applicable}
                />
              ))}
            </tr>
            <tr>
              <td className="py-1.5 pr-4 text-muted-foreground text-xs font-semibold">
                Patrimoine net apres vente
              </td>
              {comparisons.map((c) => (
                <Cell
                  key={c.regime}
                  value={c.patrimoineNetApresVente}
                  best={bestPatrimoine === c.regime}
                  format="eur"
                  dim={!c.applicability.applicable}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes per regime */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          Points d&apos;attention par regime
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {comparisons.map((c) => (
            <div
              key={c.regime}
              className={`border border-dotted rounded-md p-2.5 space-y-1 ${
                !c.applicability.applicable ? "opacity-50" : ""
              }`}
            >
              <p className="font-semibold text-[11px]">{REGIME_FISCAL_DETAILLE_SHORT[c.regime]}</p>
              <ul className="space-y-0.5">
                {c.notes.map((n, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground leading-relaxed">
                    • {n}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
