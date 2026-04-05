"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/hooks/useLocalStorage";
import { loadSimulations, hydrateSimulation } from "@/lib/simulations";
import type { SavedSimulation, CalculatorInputs } from "@/types";
import {
  computePortfolioSnapshot,
  computeSimulationContribution,
  consolidateSnapshots,
  type PortfolioSnapshot,
} from "@/lib/portfolioAggregate";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface Row {
  label: string;
  key: keyof PortfolioSnapshot;
  format: "eur" | "pct" | "int";
  invert?: boolean; // true if lower is worse (e.g. LTV)
  highlight?: boolean;
  tooltip?: string;
}

const ROWS: Row[] = [
  { label: "Nombre de biens", key: "nbBiens", format: "int" },
  { label: "Valeur du patrimoine", key: "valeurPatrimoine", format: "eur" },
  { label: "Cout d'acquisition", key: "coutAcquisition", format: "eur" },
  { label: "Apport global", key: "apportGlobal", format: "eur" },
  { label: "Capital restant du", key: "capitalRestantDu", format: "eur", invert: true },
  {
    label: "Patrimoine net (valeur - CRD)",
    key: "patrimoineNet",
    format: "eur",
    highlight: true,
    tooltip:
      "Patrimoine net = Valeur du patrimoine - Capital Restant Du.\n\n" +
      "C'est l'equivalent de l'equity : la part du patrimoine qui t'appartient\n" +
      "reellement si tu revendais tout et soldais tes credits aujourd'hui.\n\n" +
      "Decomposition :\n" +
      "  - Apport initial\n" +
      "  - Capital deja rembourse\n" +
      "  - Plus-value latente\n\n" +
      "Limites : valeur estimee avec appreciation forfaitaire (2%/an),\n" +
      "hors couts de sortie (impot PV, frais d'agence, remboursement anticipe).",
  },
  {
    label: "LTV (CRD / valeur)",
    key: "ltv",
    format: "pct",
    invert: true,
    tooltip:
      "Loan-to-Value = Capital Restant Du / Valeur du patrimoine.\n\n" +
      "< 60%  : faible endettement, grosse marge d'emprunt\n" +
      "60-80% : endettement sain, finance a credit classique\n" +
      "80-90% : endettement eleve, marge reduite\n" +
      "> 90%  : surexpose, risque de negative equity\n\n" +
      "Les banques utilisent ce ratio pour decider d'accorder un nouveau credit.",
  },
  { label: "Loyer mensuel brut", key: "loyerMensuel", format: "eur" },
  { label: "Depenses mensuelles (hors credit)", key: "depensesMensuelles", format: "eur", invert: true },
  { label: "Mensualites credit (assurance incl.)", key: "mensualitesCredit", format: "eur", invert: true },
  { label: "Cash flow mensuel net", key: "cashFlowMensuel", format: "eur", highlight: true },
];

function fmt(v: number, f: Row["format"]): string {
  if (f === "pct") return formatPercent(v * 100);
  if (f === "int") return v.toString();
  return formatCurrency(v);
}

function DeltaCell({ delta, format, invert }: { delta: number; format: Row["format"]; invert?: boolean }) {
  if (Math.abs(delta) < 0.01 && format !== "int") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (delta === 0 && format === "int") {
    return <span className="text-muted-foreground">—</span>;
  }
  const positive = delta >= 0;
  const good = invert ? !positive : positive;
  const color = good ? "text-green-600" : "text-destructive";
  const sign = positive ? "+" : "";
  return (
    <span className={`font-semibold tabular-nums ${color}`}>
      {sign}
      {fmt(delta, format)}
    </span>
  );
}

export default function ScenariosPage() {
  const { data } = useAppData();
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [selectedSimId, setSelectedSimId] = useState<string>("");
  const [simInputs, setSimInputs] = useState<CalculatorInputs | null>(null);

  useEffect(() => {
    const sims = loadSimulations();
    setSimulations(sims);
    if (sims.length > 0) setSelectedSimId(sims[0].id);
  }, []);

  // Hydrate selected simulation
  useEffect(() => {
    if (!selectedSimId) {
      setSimInputs(null);
      return;
    }
    const sim = simulations.find((s) => s.id === selectedSimId);
    if (!sim) return;
    hydrateSimulation(sim).then((hydrated) => {
      setSimInputs({ ...DEFAULT_CALCULATOR_INPUTS, ...hydrated });
    });
  }, [selectedSimId, simulations]);

  const current = useMemo(
    () => (data ? computePortfolioSnapshot(data) : null),
    [data],
  );
  const addition = useMemo(
    () => (simInputs ? computeSimulationContribution(simInputs) : null),
    [simInputs],
  );
  const consolidated = useMemo(
    () => (current && addition ? consolidateSnapshots(current, addition) : null),
    [current, addition],
  );

  if (!data) return null;

  const selectedSim = simulations.find((s) => s.id === selectedSimId);

  return (
    <div className="space-y-6">
      <div>
        <h1>Scenarios d&apos;acquisition</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simule l&apos;ajout d&apos;un bien (depuis une simulation sauvegardee) a ton portefeuille actuel.
        </p>
      </div>

      {/* Sim selector */}
      <div className="border border-dotted rounded-lg p-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">
          Simulation a ajouter
        </label>
        {simulations.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aucune simulation sauvegardee. Rends-toi dans le{" "}
            <a href="/simulateur" className="text-primary hover:underline">
              simulateur
            </a>
            .
          </p>
        ) : (
          <select
            value={selectedSimId}
            onChange={(e) => setSelectedSimId(e.target.value)}
            className="text-sm h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:border-ring min-w-[200px]"
          >
            {simulations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        )}
        {selectedSim && (
          <span className="text-[11px] text-muted-foreground">
            Sauvegardee le {new Date(selectedSim.savedAt).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>

      {current && current.nbBiens === 0 && (
        <div className="border border-dashed border-muted-foreground/30 rounded-md p-4 text-sm text-muted-foreground">
          Le portefeuille actuel est vide. Ajoute au moins un bien pour voir la consolidation.
        </div>
      )}

      {/* 3-column comparison */}
      {current && addition && consolidated && (
        <div className="border border-dotted rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dashed border-muted-foreground/20 bg-muted/20">
                <th className="text-left py-3 pl-4 pr-6 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  Indicateur
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold">Portefeuille actuel</th>
                <th className="text-right py-3 px-4 text-xs font-semibold">
                  + {selectedSim?.nom ?? "Simulation"}
                </th>
                <th className="text-right py-3 px-4 pr-6 text-xs font-semibold text-primary">
                  Consolide
                </th>
                <th className="text-right py-3 px-4 pr-6 text-xs font-semibold text-muted-foreground">
                  Delta
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const curV = current[row.key] as number;
                const addV = addition[row.key] as number;
                const consV = consolidated[row.key] as number;
                const delta = consV - curV;
                return (
                  <tr
                    key={row.key}
                    className={`border-b border-dashed border-muted-foreground/10 ${
                      row.highlight ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="py-2 pl-4 pr-6 text-xs text-muted-foreground">
                      {row.tooltip ? (
                        <span
                          title={row.tooltip}
                          className="cursor-help border-b border-dotted border-muted-foreground/40"
                        >
                          {row.label}
                        </span>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums">{fmt(curV, row.format)}</td>
                    <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">
                      {fmt(addV, row.format)}
                    </td>
                    <td
                      className={`py-2 px-4 pr-6 text-right tabular-nums font-semibold ${
                        row.highlight
                          ? consV >= 0
                            ? "text-green-600"
                            : "text-destructive"
                          : ""
                      }`}
                    >
                      {fmt(consV, row.format)}
                    </td>
                    <td className="py-2 px-4 pr-6 text-right">
                      <DeltaCell delta={delta} format={row.format} invert={row.invert} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Insights */}
      {current && addition && consolidated && current.nbBiens > 0 && (
        <div className="border border-dashed border-primary/30 bg-primary/5 rounded-md p-4 space-y-1.5 text-xs">
          <p className="font-semibold text-[11px] uppercase tracking-wider text-primary">
            Synthese
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Apres l&apos;acquisition, ton patrimoine net passerait de{" "}
            <strong className="text-foreground">{formatCurrency(current.patrimoineNet)}</strong> a{" "}
            <strong className="text-foreground">{formatCurrency(consolidated.patrimoineNet)}</strong>{" "}
            et ta LTV de{" "}
            <strong className="text-foreground">{formatPercent(current.ltv * 100)}</strong> a{" "}
            <strong className="text-foreground">{formatPercent(consolidated.ltv * 100)}</strong>.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Cash flow mensuel net :{" "}
            <strong className={current.cashFlowMensuel >= 0 ? "text-green-600" : "text-destructive"}>
              {formatCurrency(current.cashFlowMensuel)}
            </strong>{" "}
            →{" "}
            <strong
              className={
                consolidated.cashFlowMensuel >= 0 ? "text-green-600" : "text-destructive"
              }
            >
              {formatCurrency(consolidated.cashFlowMensuel)}
            </strong>{" "}
            (
            <span
              className={
                consolidated.cashFlowMensuel - current.cashFlowMensuel >= 0
                  ? "text-green-600"
                  : "text-destructive"
              }
            >
              {consolidated.cashFlowMensuel - current.cashFlowMensuel >= 0 ? "+" : ""}
              {formatCurrency(consolidated.cashFlowMensuel - current.cashFlowMensuel)}/mois
            </span>
            ).
          </p>
          {consolidated.ltv > 0.85 && (
            <p className="text-destructive">
              LTV consolidee &gt; 85% — endettement eleve, capacite d&apos;emprunt additionnelle reduite.
            </p>
          )}
          {consolidated.cashFlowMensuel < 0 && current.cashFlowMensuel >= 0 && (
            <p className="text-destructive">
              Cette acquisition ferait basculer le portefeuille en cash flow negatif.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
