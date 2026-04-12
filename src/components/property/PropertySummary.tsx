"use client";

import type { Expense, Income, LoanDetails, Property } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant, coutTotalBien } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
import { mensualiteAtMonth, mensualiteAmortissement, loanDureeTotaleMois } from "@/lib/calculations/loan";
import { Card, CardContent } from "@/components/ui/card";
import { CfTooltip } from "@/components/ui/cf-tooltip";
import { rendementBrut, rendementNet } from "@/lib/calculations/rendement";

interface PropertySummaryProps {
  property: Property;
  expenses: Expense[];
  incomes: Income[];
  loan?: LoanDetails | null;
  /** Cout total deja engage (coutTotal - travaux non tires). When provided
   *  and different from coutTotal, rendement cards show an extra row based
   *  on this capital actually drawn so far. */
  capitalUtiliseActuel?: number;
  /** Somme des loyerMensuel des lots (a pleine occupation). Affiche en
   *  petit sous "Revenu mensuel" quand different du revenu actuel. */
  revenuMensuelTheorique?: number;
}

export function PropertySummary({ property, expenses, incomes, loan, capitalUtiliseActuel, revenuMensuelTheorique }: PropertySummaryProps) {
  const revenuMensuel = incomes.reduce(
    (sum, i) => sum + mensualiserMontant(i.montant, i.frequence),
    0
  );
  const depensesMensuelles = expenses
    .filter((e) => e.categorie !== "credit")
    .reduce((sum, e) => sum + mensualiserMontant(getCurrentMontant(e), e.frequence), 0);

  // Credit: use the loan's actual current mensualite (defer-aware) instead of
  // the static credit expense which always stores the post-defer value.
  let creditMensuel: number;
  if (loan) {
    const loanStart = new Date(loan.dateDebut);
    const now = new Date();
    const monthIdx = (now.getFullYear() - loanStart.getFullYear()) * 12
      + (now.getMonth() - loanStart.getMonth());
    const totalMois = loanDureeTotaleMois(loan);
    creditMensuel = monthIdx >= 0 && monthIdx < totalMois
      ? mensualiteAtMonth(loan, monthIdx) + loan.assuranceAnnuelle / 12
      : 0;
  } else {
    creditMensuel = expenses
      .filter((e) => e.categorie === "credit")
      .reduce((sum, e) => sum + mensualiserMontant(getCurrentMontant(e), e.frequence), 0);
  }

  const cashFlow = revenuMensuel - depensesMensuelles - creditMensuel;

  // If loan has defer, compute the post-defer credit so we can show
  // "Theorique / Apres differe" as the secondary value.
  const hasDiffere = loan != null && (loan.differeMois ?? 0) > 0;

  let creditPostDiffere = creditMensuel;
  let cashFlowPostDiffere = cashFlow;
  if (hasDiffere && loan) {
    creditPostDiffere = mensualiteAmortissement(loan) + loan.assuranceAnnuelle / 12;
    cashFlowPostDiffere = revenuMensuel - depensesMensuelles - creditPostDiffere;
  }

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

  // Rendement recalcule sur le capital deja tire (coutTotal moins les travaux
  // non encore tires de l'enveloppe credit). Inutile quand egal au coutTotal.
  const showUtilise = capitalUtiliseActuel != null
    && capitalUtiliseActuel > 0
    && Math.round(capitalUtiliseActuel) !== Math.round(coutTotal);
  const rBrutUtilise = showUtilise ? rendementBrut(revenuAnnuel, capitalUtiliseActuel!) : 0;
  const rNetUtilise = showUtilise ? rendementNet(revenuAnnuel, chargesAnnuelles, capitalUtiliseActuel!) : 0;

  // Depenses et CF "theorique" = post-differe (le regime de croisiere)
  const depTheorique = depensesMensuelles + creditPostDiffere;
  const cfTheorique = cashFlowPostDiffere;

  // Depenses et CF "actuel" = ce qui est paye ce mois-ci
  const depActuel = depensesMensuelles + creditMensuel;
  const cfActuel = cashFlow;

  const fc = formatCurrency;

  /** Renders a KPI card: Actuel (main), then small "Theorique" line.
   *  When the loan has a defer, the label becomes "Theorique / Apres differe"
   *  since the theoretical value IS the post-defer amount.
   *  Wrapped in a CfTooltip that shows the full breakdown on hover. */
  const KpiCard = ({ label, theoValue, actuelValue, color, tooltipRows }: {
    label: string;
    theoValue: number;
    actuelValue: number;
    color?: (v: number) => string;
    tooltipRows: { label: string; value: string; bold?: boolean; color?: string; separator?: boolean }[];
  }) => {
    const cl = color ?? (() => "");
    const eq = (a: number, b: number) => Math.round(a) === Math.round(b);
    const showTheo = !eq(theoValue, actuelValue);
    const theoLabel = hasDiffere ? "Theorique / Apres differe" : "Theorique";
    return (
      <CfTooltip rows={tooltipRows}>
        <Card className="border-dotted h-full">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold ${cl(actuelValue)}`}>
              {fc(actuelValue)}
            </p>
            {showTheo && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">{theoLabel} : </span>
                <span className={`font-medium ${cl(theoValue)}`}>{fc(theoValue)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </CfTooltip>
    );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <CfTooltip rows={[
        ...incomes.map((i) => ({
          label: i.label || i.categorie,
          value: fc(mensualiserMontant(i.montant, i.frequence)),
        })),
        ...(incomes.length > 1
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Total", value: fc(revenuMensuel), bold: true },
            ]
          : []),
      ]}>
        <Card className="border-dotted h-full">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Revenu mensuel</p>
            <p className="text-lg font-bold">{fc(revenuMensuel)}</p>
            {(() => {
              // Fall back to the incomes total when no lots are configured so
              // the row is always visible, matching the layout of the other cards.
              const theo = revenuMensuelTheorique && revenuMensuelTheorique > 0
                ? revenuMensuelTheorique
                : revenuMensuel;
              if (theo <= 0) return null;
              return (
                <p className="text-[10px] mt-0.5">
                  <span className="text-muted-foreground">Theorique : </span>
                  <span className="font-medium">{fc(theo)}</span>
                </p>
              );
            })()}
          </CardContent>
        </Card>
      </CfTooltip>
      <KpiCard
        label="Depenses mensuelles"
        theoValue={depTheorique}
        actuelValue={depActuel}
        tooltipRows={[
          { label: "Charges (hors credit)", value: fc(depensesMensuelles) },
          { label: hasDiffere ? "Credit (ce mois)" : "Credit", value: fc(creditMensuel) },
          { separator: true, label: "", value: "" },
          { label: "Total actuel", value: fc(depActuel), bold: true },
          ...(hasDiffere
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Credit apres differe", value: fc(creditPostDiffere) },
                { label: "Total theorique", value: fc(depTheorique), bold: true },
              ]
            : []),
        ]}
      />
      <KpiCard
        label="Cash flow mensuel"
        theoValue={cfTheorique}
        actuelValue={cfActuel}
        color={(v) => v >= 0 ? "text-green-600" : "text-destructive"}
        tooltipRows={[
          { label: "Revenus", value: fc(revenuMensuel), color: "text-green-600" },
          { label: "Charges (hors credit)", value: `-${fc(depensesMensuelles)}`, color: "text-amber-600" },
          { label: hasDiffere ? "Credit (ce mois)" : "Credit", value: `-${fc(creditMensuel)}`, color: "text-amber-600" },
          { separator: true, label: "", value: "" },
          { label: "Cash flow actuel", value: fc(cfActuel), bold: true },
          ...(hasDiffere
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Credit apres differe", value: `-${fc(creditPostDiffere)}`, color: "text-amber-600" },
                { label: "Cash flow theorique", value: fc(cfTheorique), bold: true },
              ]
            : []),
        ]}
      />
      <CfTooltip rows={[
        { label: "Loyer annuel brut", value: fc(revenuAnnuel) },
        { label: "Cout total du projet", value: fc(coutTotal) },
        { separator: true, label: "", value: "" },
        { label: "Rendement", value: formatPercent(rBrut), bold: true },
        ...(showUtilise
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Capital utilise actuel", value: fc(capitalUtiliseActuel!) },
              { label: "Rendement sur capital utilise", value: formatPercent(rBrutUtilise), bold: true },
            ]
          : []),
      ]}>
        <Card className="border-dotted h-full">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Rendement brut</p>
            <p className="text-lg font-bold">{formatPercent(rBrut)}</p>
            {showUtilise && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Sur capital utilise : </span>
                <span className="font-medium">{formatPercent(rBrutUtilise)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </CfTooltip>
      <CfTooltip rows={[
        { label: "Loyer annuel", value: fc(revenuAnnuel) },
        { label: "Charges annuelles", value: `-${fc(chargesAnnuelles)}`, color: "text-amber-600" },
        { label: "Cout total du projet", value: fc(coutTotal) },
        { separator: true, label: "", value: "" },
        { label: "Rendement", value: formatPercent(rNet), bold: true },
        ...(showUtilise
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Capital utilise actuel", value: fc(capitalUtiliseActuel!) },
              { label: "Rendement sur capital utilise", value: formatPercent(rNetUtilise), bold: true },
            ]
          : []),
      ]}>
        <Card className="border-dotted h-full">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Rendement net</p>
            <p className="text-lg font-bold">{formatPercent(rNet)}</p>
            {showUtilise && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Sur capital utilise : </span>
                <span className="font-medium">{formatPercent(rNetUtilise)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </CfTooltip>
    </div>
  );
}
