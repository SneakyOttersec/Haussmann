"use client";

import type { Expense, Income, Property } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant, coutTotalBien } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
import { Card, CardContent } from "@/components/ui/card";
import { CfTooltip } from "@/components/ui/cf-tooltip";
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

  const fc = formatCurrency;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card className="border-dotted">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">Revenu mensuel</p>
          <p className="text-lg font-bold">{fc(revenuMensuel)}</p>
        </CardContent>
      </Card>
      <CfTooltip rows={[
        { label: "Charges", value: `${fc(depensesMensuelles)}/m` },
        { label: "Credit", value: `${fc(creditMensuel)}/m` },
        { separator: true, label: "", value: "" },
        { label: "Total", value: `${fc(depensesMensuelles + creditMensuel)}/m`, bold: true },
      ]}>
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Depenses mensuelles</p>
            <p className="text-lg font-bold">{fc(depensesMensuelles + creditMensuel)}</p>
          </CardContent>
        </Card>
      </CfTooltip>
      <CfTooltip rows={[
        { label: "Revenus", value: `${fc(revenuMensuel)}/m`, color: "text-green-600" },
        { label: "Charges", value: `-${fc(depensesMensuelles)}/m`, color: "text-amber-600" },
        { label: "Credit", value: `-${fc(creditMensuel)}/m`, color: "text-blue-500" },
        { separator: true, label: "", value: "" },
        { label: "Cash flow", value: `${fc(cashFlow)}/m`, bold: true, color: cashFlow >= 0 ? "text-green-600" : "text-destructive" },
      ]}>
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Cash flow mensuel</p>
            <p className={`text-lg font-bold ${cashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>{fc(cashFlow)}</p>
          </CardContent>
        </Card>
      </CfTooltip>
      <CfTooltip rows={[
        { label: "Loyer annuel brut", value: fc(revenuAnnuel) },
        { label: "Cout total du projet", value: fc(coutTotal) },
        { separator: true, label: "", value: "" },
        { label: "Rendement", value: formatPercent(rBrut), bold: true },
      ]}>
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Rendement brut</p>
            <p className="text-lg font-bold">{formatPercent(rBrut)}</p>
          </CardContent>
        </Card>
      </CfTooltip>
      <CfTooltip rows={[
        { label: "Loyer annuel", value: fc(revenuAnnuel) },
        { label: "Charges annuelles", value: `-${fc(chargesAnnuelles)}`, color: "text-amber-600" },
        { label: "Cout total du projet", value: fc(coutTotal) },
        { separator: true, label: "", value: "" },
        { label: "Rendement", value: formatPercent(rNet), bold: true },
      ]}>
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Rendement net</p>
            <p className="text-lg font-bold">{formatPercent(rNet)}</p>
          </CardContent>
        </Card>
      </CfTooltip>
    </div>
  );
}
