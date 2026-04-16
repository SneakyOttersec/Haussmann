"use client";

import type { DonneesApp, StatutBien } from "@/types";
import { STATUT_BIEN_ORDER } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant, coutTotalBien, getPropertyAcquisitionDate } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
import { rendementBrut } from "@/lib/calculations/rendement";
import { Card, CardContent } from "@/components/ui/card";
import { CfTooltip } from "@/components/ui/cf-tooltip";

const PRE_ACTE: StatutBien[] = ['prospection', 'offre', 'compromis'];

function isActive(statut?: StatutBien): boolean {
  if (!statut) return true;
  return !PRE_ACTE.includes(statut);
}

interface PortfolioSummaryProps {
  data: DonneesApp;
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
  const { settings } = data;
  const associes = settings.associes ?? [];

  // Only include post-acte properties in financial summaries
  const activeIds = new Set(data.properties.filter(p => !p.deletedAt && isActive(p.statut)).map(p => p.id));
  const properties = data.properties.filter(p => activeIds.has(p.id));
  const expenses = data.expenses.filter(e => activeIds.has(e.propertyId));
  const incomes = data.incomes.filter(i => activeIds.has(i.propertyId));
  const loans = data.loans.filter(l => activeIds.has(l.propertyId));
  const rentTracking = (data.rentTracking ?? []).filter(r => activeIds.has(r.propertyId));
  const lots = (data.lots ?? []).filter(l => activeIds.has(l.propertyId));

  const capitalTotal = properties.reduce((sum, p) => sum + coutTotalBien(p), 0);
  const totalEmprunte = loans.reduce((sum, l) => sum + l.montantEmprunte, 0);
  const apportGlobal = Math.max(0, capitalTotal - totalEmprunte);

  /* ── Theorique : projections recurrentes ──
     Pour le loyer : on preferre la somme des lots.loyerMensuel (pleine
     occupation, disponible des l'acte signe) — sinon fallback sur les
     incomes categorie "loyer" (cas ou les lots ne sont pas encore saisis).
     Les autres incomes (non-loyer) sont toujours additionnes. */
  const loyerIncomesMensuel = incomes
    .filter((i) => i.categorie === "loyer")
    .reduce((sum, i) => sum + mensualiserMontant(i.montant, i.frequence), 0);
  const loyerIncomesAnnuel = incomes
    .filter((i) => i.categorie === "loyer")
    .reduce((sum, i) => sum + annualiserMontant(i.montant, i.frequence), 0);
  const autresIncomesMensuel = incomes
    .filter((i) => i.categorie !== "loyer")
    .reduce((sum, i) => sum + mensualiserMontant(i.montant, i.frequence), 0);
  const autresIncomesAnnuel = incomes
    .filter((i) => i.categorie !== "loyer")
    .reduce((sum, i) => sum + annualiserMontant(i.montant, i.frequence), 0);
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const lotsMensuel = lots.reduce((s, l) => {
    const p = propertyById.get(l.propertyId);
    const vac = p?.tauxVacanceGlobal != null ? p.tauxVacanceGlobal : (l.tauxVacance ?? 0);
    return s + (l.loyerMensuel ?? 0) * (1 - vac);
  }, 0);
  const loyerTheoMensuel = lotsMensuel > 0 ? lotsMensuel : loyerIncomesMensuel;
  const loyerTheoAnnuel = lotsMensuel > 0 ? lotsMensuel * 12 : loyerIncomesAnnuel;

  const revenusTheoMensuel = loyerTheoMensuel + autresIncomesMensuel;
  const depensesTheoMensuel = expenses.reduce(
    (sum, e) => sum + mensualiserMontant(getCurrentMontant(e), e.frequence),
    0,
  );
  const cashFlowTheoMensuel = revenusTheoMensuel - depensesTheoMensuel;
  const revenuAnnuelTheo = loyerTheoAnnuel + autresIncomesAnnuel;
  const rdtBrutTheo = capitalTotal > 0 ? rendementBrut(revenuAnnuelTheo, capitalTotal) : 0;

  /* ── Reel : base sur le suivi des loyers (/loyers) ── */
  // Window = min(12, months since earliest property acquisition).
  // If the portfolio is younger than 12 months, we extrapolate from the available data.
  const now = new Date();
  const allDates = properties.map(p => new Date(getPropertyAcquisitionDate(p))).filter((d) => !isNaN(d.getTime()));
  const earliestAchat = allDates.length > 0
    ? allDates.reduce((min, d) => (d < min ? d : min))
    : now;
  const monthsSinceStart = (now.getFullYear() - earliestAchat.getFullYear()) * 12
    + (now.getMonth() - earliestAchat.getMonth()) + 1;
  const effectiveMonths = Math.max(1, Math.min(12, monthsSinceStart));
  const isExtrapolated = effectiveMonths < 12;

  const windowMonths = monthsWindow(effectiveMonths);
  const loyersReelsSum = (rentTracking ?? [])
    .filter((e) => windowMonths.includes(e.yearMonth))
    .reduce((s, e) => s + e.loyerPercu, 0);
  const loyersReelsMensuel = loyersReelsSum / effectiveMonths;

  const autresRevenusTheoMensuel = incomes
    .filter((i) => i.categorie !== "loyer")
    .reduce((s, i) => s + mensualiserMontant(i.montant, i.frequence), 0);

  const revenusReelMensuel = loyersReelsMensuel + autresRevenusTheoMensuel;
  const depensesReelMensuel = depensesTheoMensuel; // non-trackees → identique au theorique
  const cashFlowReelMensuel = revenusReelMensuel - depensesReelMensuel;
  const rdtBrutReel = capitalTotal > 0
    ? rendementBrut((loyersReelsMensuel + autresRevenusTheoMensuel) * 12, capitalTotal)
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
        <CfTooltip rows={[
          { label: "Revenus", value: `${formatCurrency(revenus)}/m`, color: "text-green-600" },
          { label: "Depenses", value: `-${formatCurrency(depenses)}/m`, color: "text-amber-600" },
          { separator: true, label: "", value: "" },
          { label: "Cash flow", value: `${formatCurrency(cashFlow)}/m`, bold: true, color: cashFlow >= 0 ? "text-green-600" : "text-destructive" },
        ]}>
          <Card className="border-dotted">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Cash flow</p>
              <p className={`text-lg font-bold ${cashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(cashFlow)}<span className="text-[10px] text-muted-foreground">/m</span>
              </p>
            </CardContent>
          </Card>
        </CfTooltip>
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
      {/* Capital + apport + associes */}
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
            {associes.length > 1 && (
              <div className="mt-1.5 pt-1.5 border-t border-dashed border-muted-foreground/15 space-y-0.5">
                {associes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{a.nom} ({a.quotePart}%)</span>
                    <span className="tabular-nums">{formatCurrency(apportGlobal * a.quotePart / 100)}</span>
                  </div>
                ))}
              </div>
            )}
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
      <div>
        <Row
          label={
            isExtrapolated
              ? `Reel (extrapole sur ${effectiveMonths} mois de donnees)`
              : "Reel (loyers 12 derniers mois)"
          }
          revenus={revenusReelMensuel}
          depenses={depensesReelMensuel}
          cashFlow={cashFlowReelMensuel}
          rendement={rdtBrutReel}
        />
        {isExtrapolated && (
          <p className="text-[10px] text-amber-700 mt-1.5 italic">
            ⚠ Moins de 12 mois d&apos;exploitation — les moyennes mensuelles sont extrapolees sur {effectiveMonths} mois disponibles.
          </p>
        )}
      </div>
    </div>
  );
}
