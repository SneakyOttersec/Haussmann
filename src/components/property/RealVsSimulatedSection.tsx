"use client";

import { useState, useEffect, useMemo } from "react";
import type { Property, Income, Expense, YearProjection, CalculatorInputs } from "@/types";
import { loadSimulations, hydrateSimulation } from "@/lib/simulations";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { calculerRentabilite } from "@/lib/calculations";
import { formatCurrency, annualiserMontant } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface Props {
  property: Property;
  incomes: Income[];
  expenses: Expense[];
}

const fmtEur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");

export function RealVsSimulatedSection({ property, incomes, expenses }: Props) {
  const [projection, setProjection] = useState<YearProjection[] | null>(null);

  useEffect(() => {
    if (!property.simulationId) return;
    const sims = loadSimulations();
    const sim = sims.find((s) => s.id === property.simulationId);
    if (!sim) return;
    hydrateSimulation(sim).then((hydrated) => {
      const inputs: CalculatorInputs = { ...DEFAULT_CALCULATOR_INPUTS, ...hydrated };
      const results = calculerRentabilite(inputs);
      setProjection(results.projection);
    });
  }, [property.simulationId]);

  // Actual annual cash flow
  const actualAnnualCF = useMemo(() => {
    const rev = incomes.reduce((s, i) => s + annualiserMontant(i.montant, i.frequence), 0);
    const dep = expenses.reduce((s, e) => s + annualiserMontant(e.montant, e.frequence), 0);
    return rev - dep;
  }, [incomes, expenses]);

  if (!property.simulationId) return null;
  if (!projection) return null;

  const years = Math.min(10, projection.length);
  const data = [];
  for (let i = 0; i < years; i++) {
    const p = projection[i];
    data.push({
      annee: `A${i + 1}`,
      simule: Math.round(p.cashFlowApresImpot),
      reel: i === 0 ? Math.round(actualAnnualCF) : null, // Only current year has real data
    });
  }

  // For the current year comparison
  const simY1 = projection[0]?.cashFlowApresImpot ?? 0;
  const ecart = actualAnnualCF - simY1;

  return (
    <Card className="border-dotted">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Reel vs Simule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 text-[11px] text-muted-foreground mb-3">
          <span>CF annuel reel : <strong className={actualAnnualCF >= 0 ? "text-green-600" : "text-destructive"}>{formatCurrency(actualAnnualCF)}</strong></span>
          <span>CF annuel simule (A1) : <strong className="text-foreground">{formatCurrency(simY1)}</strong></span>
          <span>Ecart : <strong className={ecart >= 0 ? "text-green-600" : "text-destructive"}>{ecart >= 0 ? "+" : ""}{formatCurrency(ecart)}</strong></span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="annee" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
            <Tooltip formatter={(value) => [value != null ? fmtEur(Number(value)) : "—"]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            <Line type="monotone" dataKey="simule" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} name="Simule" />
            <Line type="monotone" dataKey="reel" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: "#16a34a" }} name="Reel" connectNulls={false} />
            <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground mt-2">Le point vert represente le cash flow reel actuel. La courbe bleue montre la projection du simulateur.</p>
      </CardContent>
    </Card>
  );
}
