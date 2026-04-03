"use client";

import type { AppData } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant, coutTotalBien } from "@/lib/utils";
import { rendementBrut } from "@/lib/calculations/rendement";
import { Card, CardContent } from "@/components/ui/card";

interface PortfolioSummaryProps {
  data: AppData;
}

export function PortfolioSummary({ data }: PortfolioSummaryProps) {
  const { properties, expenses, incomes, loans, settings } = data;
  const associes = settings.associes ?? [];

  const capitalTotal = properties.reduce((sum, p) => sum + coutTotalBien(p), 0);
  const totalEmprunte = loans.reduce((sum, l) => sum + l.montantEmprunte, 0);
  const apportGlobal = Math.max(0, capitalTotal - totalEmprunte);

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
  const coutTotalPortfolio = properties.reduce((sum, p) => sum + coutTotalBien(p), 0);
  const rBrutMoyen = coutTotalPortfolio > 0 ? rendementBrut(revenuAnnuelTotal, coutTotalPortfolio) : 0;

  const kpis = [
    { label: "Capital investi", value: formatCurrency(capitalTotal) },
    { label: "Revenus mensuels", value: formatCurrency(revenuMensuelTotal) },
    { label: "Depenses mensuelles", value: formatCurrency(depensesMensuellesTotal) },
    { label: "Cash flow mensuel", value: formatCurrency(cashFlowTotal), highlight: true, positive: cashFlowTotal >= 0 },
    { label: "Rendement brut moyen", value: formatPercent(rBrutMoyen) },
  ];

  return (
    <div className="space-y-3">
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

      {/* Apport global + repartition associes */}
      <Card className="border-dotted">
        <CardContent className="p-4">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs text-muted-foreground">Apport global</p>
            <p className="text-lg font-bold">{formatCurrency(apportGlobal)}</p>
          </div>
          {associes.length > 1 && (
            <div className="space-y-1 border-t border-dashed border-muted-foreground/15 pt-2">
              {associes.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{a.nom} <span className="text-[10px]">({a.quotePart}%)</span></span>
                  <span className="font-medium tabular-nums">{formatCurrency(apportGlobal * a.quotePart / 100)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
