"use client";

import { useMemo } from "react";
import type { CalculatorInputs } from "@/types";
import { computeSensitivity, type SensitivityResult } from "@/lib/calculations/sensitivity";
import { formatPercent } from "@/lib/utils";

interface Props {
  inputs: CalculatorInputs;
}

function signed(v: number): string {
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(2)} pt`;
}

function Bar({ result, maxSpread }: { result: SensitivityResult; maxSpread: number }) {
  const { deltaLow, deltaHigh } = result;

  // Normalize widths to the max spread across all params
  const scale = maxSpread > 0 ? 100 / maxSpread : 0;
  const widthLow = Math.abs(deltaLow) * scale;
  const widthHigh = Math.abs(deltaHigh) * scale;

  // Bars extend from center line. Left = deltaLow if negative (or right if positive).
  const lowLeft = deltaLow < 0;
  const highLeft = deltaHigh < 0;

  return (
    <div className="grid grid-cols-[140px_1fr_80px] items-center gap-2 text-xs py-1">
      <div className="text-muted-foreground truncate" title={result.label}>
        <span>{result.label}</span>
        <span className="ml-1.5 text-[9px] text-muted-foreground/60">{result.variationLabel}</span>
      </div>
      <div className="relative h-5">
        {/* Center line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/30" />

        {/* Low bar */}
        {deltaLow !== 0 && (
          <div
            className={`absolute inset-y-0.5 ${deltaLow < 0 ? "bg-destructive/60" : "bg-green-600/60"} rounded-sm`}
            style={{
              [lowLeft ? "right" : "left"]: "50%",
              width: `${(widthLow / 2).toFixed(4)}%`,
            }}
            title={`${deltaLow < 0 ? "Defavorable" : "Favorable"} : ${signed(deltaLow)}`}
          />
        )}

        {/* High bar */}
        {deltaHigh !== 0 && (
          <div
            className={`absolute inset-y-0.5 ${deltaHigh < 0 ? "bg-destructive/60" : "bg-green-600/60"} rounded-sm`}
            style={{
              [highLeft ? "right" : "left"]: "50%",
              width: `${(widthHigh / 2).toFixed(4)}%`,
            }}
            title={`${deltaHigh < 0 ? "Defavorable" : "Favorable"} : ${signed(deltaHigh)}`}
          />
        )}
      </div>
      <div className="text-right tabular-nums text-[10px] text-muted-foreground">
        {result.spread.toFixed(2)} pt
      </div>
    </div>
  );
}

export function SensitivityChart({ inputs }: Props) {
  const results = useMemo(() => computeSensitivity(inputs), [inputs]);
  const maxSpread = Math.max(...results.map((r) => r.spread), 0.01);
  const triBase = results[0]?.triBase ?? 0;

  return (
    <div className="border border-dotted rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider">Analyse de sensibilite</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Impact d&apos;une variation de chaque parametre sur le TRI investisseur (10 ans).
          </p>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">TRI de reference :</span>{" "}
          <span className="font-semibold">{formatPercent(triBase)}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-0.5">
        {/* Header */}
        <div className="grid grid-cols-[140px_1fr_80px] items-center gap-2 text-[9px] uppercase tracking-wider text-muted-foreground/60 pb-1 border-b border-dashed border-muted-foreground/15">
          <div>Parametre</div>
          <div className="relative text-center">
            <span className="absolute left-0">Defavorable</span>
            <span>0</span>
            <span className="absolute right-0">Favorable</span>
          </div>
          <div className="text-right">Amplitude</div>
        </div>

        {results.map((r) => (
          <Bar key={r.key} result={r} maxSpread={maxSpread} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground pt-2 border-t border-dashed border-muted-foreground/15">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-600/60" />
          <span>Variation favorable au TRI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-destructive/60" />
          <span>Variation defavorable au TRI</span>
        </div>
        <div className="ml-auto text-muted-foreground/60">
          Les parametres sont tries par amplitude d&apos;impact.
        </div>
      </div>
    </div>
  );
}
