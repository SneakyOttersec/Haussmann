"use client";

import type { AppData } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant } from "@/lib/utils";
import { rendementBrut } from "@/lib/calculations/rendement";
import { Card, CardContent } from "@/components/ui/card";

interface PortfolioSummaryProps {
  data: AppData;
}

export function PortfolioSummary({ data }: PortfolioSummaryProps) {
  const { properties, expenses, incomes } = data;

  const capitalTotal = properties.reduce((sum, p) => sum + p.prixAchat + p.fraisNotaire + p.montantTravaux, 0);

  const revenuMensuelTotal = incomes.reduce(
    (sum, i) => sum + mensualiserMontant(i.montant, i.frequence),
    0
  );
  const depensesMensuellesTotal = expenses.reduce(
    (sum, e) => sum + mensualiserMontant(e.montant, e.frequence),
    0
  );
  const cashFlowTotal = revenuMensuelTotal - depensesMensuellesTotal;

  const revenuAnnuelTotal = incomes.reduce(
    (sum, i) => sum + annualiserMontant(i.montant, i.frequence),
    0
  );
  const coutTotalPortfolio = properties.reduce((sum, p) => sum + p.prixAchat + p.fraisNotaire + p.montantTravaux, 0);
  const rBrutMoyen = coutTotalPortfolio > 0 ? rendementBrut(revenuAnnuelTotal, coutTotalPortfolio) : 0;

  const kpis = [
    { label: "Capital investi", value: formatCurrency(capitalTotal) },
    { label: "Revenus mensuels", value: formatCurrency(revenuMensuelTotal) },
    { label: "Depenses mensuelles", value: formatCurrency(depensesMensuellesTotal) },
    { label: "Cash flow mensuel", value: formatCurrency(cashFlowTotal), highlight: true, positive: cashFlowTotal >= 0 },
    { label: "Rendement brut moyen", value: formatPercent(rBrutMoyen) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-dotted">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.highlight ? (kpi.positive ? "text-green-600" : "text-destructive") : ""}`}>
              {kpi.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
