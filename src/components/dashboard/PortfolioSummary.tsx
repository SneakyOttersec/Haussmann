"use client";

import type { AppData } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant, coutTotalBien } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
import { rendementBrut } from "@/lib/calculations/rendement";
import { Card, CardContent } from "@/components/ui/card";

interface PortfolioSummaryProps {
  data: AppData;
}

function monthsWindow(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${yyyy}-${mm}`);
  }
  return months;
}

export function PortfolioSummary({ data }: PortfolioSummaryProps) {
  const { properties, expenses, incomes, loans, rentTracking, settings } = data;
  const associes = settings.associes ?? [];

  const capitalTotal = properties.reduce((sum, p) => sum + coutTotalBien(p), 0);
  const totalEmprunte = loans.reduce((sum, l) => sum + l.montantEmprunte, 0);
  const apportGlobal = Math.max(0, capitalTotal - totalEmprunte);

  /* ── Theorique : projections recurrentes ── */
  const revenusTheoMensuel = incomes.reduce(
    (sum, i) => sum + mensualiserMontant(i.montant, i.frequence),
    0,
  );
  const depensesTheoMensuel = expenses.reduce(
    (sum, e) => sum + mensualiserMontant(getCurrentMontant(e), e.frequence),
    0,
  );
  const cashFlowTheoMensuel = revenusTheoMensuel - depensesTheoMensuel;
  const revenuAnnuelTheo = incomes.reduce(
    (sum, i) => sum + annualiserMontant(i.montant, i.frequence),
    0,
  );
  const rdtBrutTheo = capitalTotal > 0 ? rendementBrut(revenuAnnuelTheo, capitalTotal) : 0;

  /* ── Reel : base sur le suivi des loyers (/loyers) ── */
  // Fixed 12-month window; loyers come from rentTracking, everything else is projected.
  const last12 = monthsWindow(12);
  const loyersReels12m = (rentTracking ?? [])
    .filter((e) => last12.includes(e.yearMonth))
    .reduce((s, e) => s + e.loyerPercu, 0);
  const loyersReelsMensuel = loyersReels12m / 12;

  const autresRevenusTheoMensuel = incomes
    .filter((i) => i.categorie !== "loyer")
    .reduce((s, i) => s + mensualiserMontant(i.montant, i.frequence), 0);

  const revenusReelMensuel = loyersReelsMensuel + autresRevenusTheoMensuel;
  const depensesReelMensuel = depensesTheoMensuel; // non-trackees → identique au theorique
  const cashFlowReelMensuel = revenusReelMensuel - depensesReelMensuel;
  const rdtBrutReel = capitalTotal > 0
    ? rendementBrut(loyersReels12m + autresRevenusTheoMensuel * 12, capitalTotal)
    : 0;

  const Row = ({
    label,
    revenus,
    depenses,
    cashFlow,
    rendement,
    dim,
  }: {
    label: string;
    revenus: number;
    depenses: number;
    cashFlow: number;
    rendement: number;
    dim?: boolean;
  }) => (
    <div>
      <p className={`text-[10px] uppercase tracking-wider ${dim ? "text-muted-foreground" : "text-primary font-semibold"} mb-1`}>
        {label}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Revenus</p>
            <p className="text-lg font-bold">{formatCurrency(revenus)}<span className="text-[10px] text-muted-foreground">/m</span></p>
          </CardContent>
        </Card>
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Depenses</p>
            <p className="text-lg font-bold">{formatCurrency(depenses)}<span className="text-[10px] text-muted-foreground">/m</span></p>
          </CardContent>
        </Card>
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Cash flow</p>
            <p className={`text-lg font-bold ${cashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(cashFlow)}<span className="text-[10px] text-muted-foreground">/m</span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Rendement brut</p>
            <p className="text-lg font-bold">{formatPercent(rendement)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Capital + apport */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Capital investi</p>
            <p className="text-lg font-bold">{formatCurrency(capitalTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-dotted">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Apport global</p>
            <p className="text-lg font-bold">{formatCurrency(apportGlobal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Theorique */}
      <Row
        label="Theorique (projection recurrente)"
        revenus={revenusTheoMensuel}
        depenses={depensesTheoMensuel}
        cashFlow={cashFlowTheoMensuel}
        rendement={rdtBrutTheo}
        dim
      />

      {/* Reel */}
      <Row
        label="Reel (loyers 12 derniers mois)"
        revenus={revenusReelMensuel}
        depenses={depensesReelMensuel}
        cashFlow={cashFlowReelMensuel}
        rendement={rdtBrutReel}
      />

      {/* Repartition associes */}
      {associes.length > 1 && (
        <Card className="border-dotted">
          <CardContent className="p-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs text-muted-foreground">Repartition associes</p>
            </div>
            <div className="space-y-1 border-t border-dashed border-muted-foreground/15 pt-2">
              {associes.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {a.nom} <span className="text-[10px]">({a.quotePart}%)</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(apportGlobal * a.quotePart / 100)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
