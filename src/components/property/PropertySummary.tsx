"use client";

import type { Expense, Income, Property } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant, coutTotalBien } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
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
    .reduce((sum, e) => sum + mensualiserMontant(getCurrentMontant(e), e.frequence), 0);
  const creditMensuel = expenses
    .filter((e) => e.categorie === "credit")
    .reduce((sum, e) => sum + mensualiserMontant(getCurrentMontant(e), e.frequence), 0);

  const cashFlow = revenuMensuel - depensesMensuelles - creditMensuel;

  const revenuAnnuel = incomes.reduce(
    (sum, i) => sum + annualiserMontant(i.montant, i.frequence),
    0
  );
  const chargesAnnuelles = expenses
    .filter((e) => e.categorie !== "credit")
    .reduce((sum, e) => sum + annualiserMontant(getCurrentMontant(e), e.frequence), 0);

  const coutTotal = coutTotalBien(property);
  const rBrut = rendementBrut(revenuAnnuel, coutTotal);
  const rNet = rendementNet(revenuAnnuel, chargesAnnuelles, coutTotal);

  const cfTooltip = `Revenus : ${formatCurrency(revenuMensuel)}/m\nCharges : -${formatCurrency(depensesMensuelles)}/m\nCredit : -${formatCurrency(creditMensuel)}/m\n= Cash flow : ${formatCurrency(cashFlow)}/m`;

  const kpis = [
    { label: "Revenu mensuel", value: formatCurrency(revenuMensuel), accent: false, tooltip: undefined as string | undefined },
    { label: "Depenses mensuelles", value: formatCurrency(depensesMensuelles + creditMensuel), accent: false, tooltip: `Charges : ${formatCurrency(depensesMensuelles)}/m\nCredit : ${formatCurrency(creditMensuel)}/m` },
    { label: "Cash flow mensuel", value: formatCurrency(cashFlow), accent: true, tooltip: cfTooltip },
    { label: "Rendement brut", value: formatPercent(rBrut), accent: false, tooltip: `Loyer annuel brut : ${formatCurrency(revenuAnnuel)}\nCout total : ${formatCurrency(coutTotal)}` },
    { label: "Rendement net", value: formatPercent(rNet), accent: false, tooltip: `Loyer annuel : ${formatCurrency(revenuAnnuel)}\nCharges annuelles : -${formatCurrency(chargesAnnuelles)}\nCout total : ${formatCurrency(coutTotal)}` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-dotted" title={kpi.tooltip}>
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
