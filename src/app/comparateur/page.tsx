"use client";

import { useState, useEffect, useMemo } from "react";
import { loadSimulations, hydrateSimulation } from "@/lib/simulations";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { calculerRentabilite } from "@/lib/calculations";
import type { SavedSimulation, CalculatorInputs, CalculatorResults } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface ComparedSimulation {
  sim: SavedSimulation;
  inputs: CalculatorInputs;
  results: CalculatorResults;
}

function KpiCell({ value, isBest, format }: { value: number; isBest: boolean; format: "eur" | "pct" }) {
  return (
    <td className={`py-1.5 px-3 text-right tabular-nums ${isBest ? "font-bold text-green-600" : ""}`}>
      {format === "eur" ? formatCurrency(value) : formatPercent(value)}
    </td>
  );
}

export default function Comparateur() {
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [selected, setSelected] = useState<ComparedSimulation[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    setSimulations(loadSimulations());
  }, []);

  const toggleSim = async (sim: SavedSimulation) => {
    const existing = selected.find((s) => s.sim.id === sim.id);
    if (existing) {
      setSelected(selected.filter((s) => s.sim.id !== sim.id));
      return;
    }
    if (selected.length >= 4) return;

    setLoading(sim.id);
    const hydrated = await hydrateSimulation(sim);
    const inputs = { ...DEFAULT_CALCULATOR_INPUTS, ...hydrated };
    const results = calculerRentabilite(inputs);
    setSelected([...selected, { sim, inputs, results }]);
    setLoading(null);
  };

  const isSelected = (id: string) => selected.some((s) => s.sim.id === id);

  const rows = useMemo(() => {
    if (selected.length === 0) return [];
    const vals = selected.map((s) => s.results);
    const inp = selected.map((s) => s.inputs);

    type Row = { label: string; values: number[]; format: "eur" | "pct"; higherIsBetter: boolean };
    const r: Row[] = [
      { label: "Prix d'achat", values: inp.map((i) => i.prixAchat), format: "eur", higherIsBetter: false },
      { label: "Cout total acquisition", values: vals.map((v) => v.coutTotalAcquisition), format: "eur", higherIsBetter: false },
      { label: "Apport personnel", values: vals.map((v) => v.apportPersonnel), format: "eur", higherIsBetter: false },
      { label: "Loyer annuel brut", values: vals.map((v) => v.loyerAnnuelBrut), format: "eur", higherIsBetter: true },
      { label: "Charges annuelles", values: vals.map((v) => v.chargesAnnuellesTotales), format: "eur", higherIsBetter: false },
      { label: "Rendement brut", values: vals.map((v) => v.rendementBrut), format: "pct", higherIsBetter: true },
      { label: "Rendement net", values: vals.map((v) => v.rendementNet), format: "pct", higherIsBetter: true },
      { label: "Cash flow mensuel", values: vals.map((v) => v.cashFlowMensuelApresImpot), format: "eur", higherIsBetter: true },
      { label: "Cash flow annuel", values: vals.map((v) => v.cashFlowAnnuelApresImpot), format: "eur", higherIsBetter: true },
      { label: "TAEG", values: vals.map((v) => v.taeg), format: "pct", higherIsBetter: false },
      { label: "Impot annuel (an 1)", values: vals.map((v) => v.impotAnnuel), format: "eur", higherIsBetter: false },
      { label: "TRI 10 ans", values: vals.map((v) => v.tri), format: "pct", higherIsBetter: true },
    ];
    return r;
  }, [selected]);

  return (
    <div className="space-y-6">
      <h1>Comparateur de simulations</h1>

      {simulations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune simulation sauvegardee. Sauvegardez des simulations dans le calculateur pour les comparer.</p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Selectionnez jusqu&apos;a 4 simulations</p>
            <div className="flex flex-wrap gap-2">
              {simulations.map((sim) => (
                <button
                  key={sim.id}
                  onClick={() => toggleSim(sim)}
                  disabled={loading === sim.id}
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                    isSelected(sim.id)
                      ? "bg-primary text-primary-foreground font-medium"
                      : selected.length >= 4
                      ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {loading === sim.id ? "..." : sim.nom}
                </button>
              ))}
            </div>
          </div>

          {selected.length >= 2 && (
            <div className="border border-dotted rounded-lg p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dashed border-muted-foreground/20">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium min-w-[180px]"></th>
                    {selected.map((s) => (
                      <th key={s.sim.id} className="text-right py-2 px-3 font-medium min-w-[120px]">
                        {s.sim.nom}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const best = row.higherIsBetter
                      ? Math.max(...row.values)
                      : Math.min(...row.values);
                    return (
                      <tr key={row.label} className="border-b border-dashed border-muted-foreground/10 hover:bg-muted/20">
                        <td className="py-1.5 pr-4 text-muted-foreground">{row.label}</td>
                        {row.values.map((v, i) => (
                          <KpiCell
                            key={selected[i].sim.id}
                            value={v}
                            isBest={selected.length > 1 && v === best}
                            format={row.format}
                          />
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selected.length === 1 && (
            <p className="text-sm text-muted-foreground">Selectionnez au moins une deuxieme simulation pour comparer.</p>
          )}
        </>
      )}
    </div>
  );
}
