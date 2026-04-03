"use client";

import type { Expense, Income, Property } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant, coutTotalBien } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { rendementBrut, rendementNet } from "@/lib/calculations/rendement";

interface PropertySummaryProps {
  property: Property;
  expenses: Expense[];
  incomes: Income[];
}

export function PropertySummary({ property, expenses, incomes }: PropertySummaryProps) {
  const revenuMensuel = incomes.reduce(
    (sum, i) => sum + mensualiserMontant(i.montant, i.frequence),
    0
  );
  const depensesMensuelles = expenses
    .filter((e) => e.categorie !== "credit")
    .reduce((sum, e) => sum + mensualiserMontant(e.montant, e.frequence), 0);
  const creditMensuel = expenses
    .filter((e) => e.categorie === "credit")
    .reduce((sum, e) => sum + mensualiserMontant(e.montant, e.frequence), 0);

  const cashFlow = revenuMensuel - depensesMensuelles - creditMensuel;

  const revenuAnnuel = incomes.reduce(
    (sum, i) => sum + annualiserMontant(i.montant, i.frequence),
    0
  );
  const chargesAnnuelles = expenses
    .filter((e) => e.categorie !== "credit")
    .reduce((sum, e) => sum + annualiserMontant(e.montant, e.frequence), 0);

  const coutTotal = coutTotalBien(property);
  const rBrut = rendementBrut(revenuAnnuel, coutTotal);
  const rNet = rendementNet(revenuAnnuel, chargesAnnuelles, coutTotal);

  const kpis = [
    { label: "Revenu mensuel", value: formatCurrency(revenuMensuel), accent: false },
    { label: "Depenses mensuelles", value: formatCurrency(depensesMensuelles + creditMensuel), accent: false },
    { label: "Cash flow mensuel", value: formatCurrency(cashFlow), accent: true },
    { label: "Rendement brut", value: formatPercent(rBrut), accent: false },
    { label: "Rendement net", value: formatPercent(rNet), accent: false },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-dotted">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.accent ? (cashFlow >= 0 ? "text-green-600" : "text-destructive") : ""}`}>
              {kpi.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
