"use client";

import { useEffect, useState } from "react";
import type { CalculatorInputs, Expense, Income, LoanDetails, Lot, Property, PropertyStatus, RentMonthEntry } from "@/types";
import { PROPERTY_STATUS_ORDER } from "@/types";
import { formatCurrency, formatPercent, mensualiserMontant, annualiserMontant, coutTotalBien } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
import { mensualiteAtMonth, mensualiteAmortissement, loanDureeTotaleMois } from "@/lib/calculations/loan";
import { Card, CardContent } from "@/components/ui/card";
import { CfTooltip } from "@/components/ui/cf-tooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { rendementBrut, rendementNet } from "@/lib/calculations/rendement";
import { calculerRentabilite } from "@/lib/calculations";
import { loadSimulations, hydrateSimulation } from "@/lib/simulations";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";

interface SimKpis {
  revenuMensuel: number;
  depensesMensuellesHorsCredit: number;
  creditMensuel: number;
  depensesMensuellesTotal: number;
  cashFlowMensuel: number;
  rendementBrut: number;
  rendementNet: number;
  tauxVacance: number; // 0..1, taux de vacance defini dans la simulation
}

function statusAtLeast(statut: PropertyStatus | undefined, min: PropertyStatus): boolean {
  if (!statut) return true; // backward compat
  return PROPERTY_STATUS_ORDER.indexOf(statut) >= PROPERTY_STATUS_ORDER.indexOf(min);
}

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
  /** Mensualite post-differe calculee sur le capital effectivement tire
   *  (principal + assurance). Quand fourni et different du post-differe
   *  theorique, un sous-montant "Apres differe sur capital utilise" est
   *  affiche sur Depenses et Cash flow. */
  creditApresDiffereSurUtilise?: number;
  /** Lots pour calculer occupation + loyer theorique et le breakdown. */
  lots?: Lot[];
  /** Rent entries pour deriver le loyer percu du mois courant + impayes. */
  rentEntries?: RentMonthEntry[];
  /** Somme brute des loyers des lots a 100% d'occupation (sans vacance).
   *  Si fourni ET different de revenuMensuelTheorique, une ligne "Max"
   *  est affichee sur les cards Revenu / Cash flow / Rendement. */
  revenuMensuelMax?: number;
}

export function PropertySummary({
  property,
  expenses,
  incomes,
  loan,
  capitalUtiliseActuel,
  revenuMensuelTheorique,
  creditApresDiffereSurUtilise,
  lots,
  rentEntries,
  revenuMensuelMax,
}: PropertySummaryProps) {
  // ── Simulation initiale : charge les inputs et calcule les KPIs de l'annee 1.
  // Resultats mis en cache par property.simulationId pour eviter les re-compute
  // a chaque render. null = pas de sim ou chargement en cours. Affichee
  // uniquement dans les tooltips des cards (plus en ligne sur la card).
  const [simKpis, setSimKpis] = useState<SimKpis | null>(null);
  // Toggle pour afficher les lignes etendues (Optimum + Simulation initiale)
  // sur les cards. Replie par defaut pour un affichage plus compact.
  const [showExtended, setShowExtended] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSimKpis(null);
    if (!property.simulationId) return;
    const sim = loadSimulations().find((s) => s.id === property.simulationId);
    if (!sim) return;
    hydrateSimulation(sim).then((hydrated) => {
      if (cancelled) return;
      const inputs: CalculatorInputs = { ...DEFAULT_CALCULATOR_INPUTS, ...hydrated };
      const results = calculerRentabilite(inputs);
      const depensesMensuellesHorsCredit = results.chargesAnnuellesTotales / 12;
      const creditMensuel = results.mensualiteCredit;
      setSimKpis({
        revenuMensuel: results.loyerAnnuelBrut / 12,
        depensesMensuellesHorsCredit,
        creditMensuel,
        depensesMensuellesTotal: depensesMensuellesHorsCredit + creditMensuel,
        cashFlowMensuel: results.cashFlowMensuelAvantImpot,
        rendementBrut: results.rendementBrut,
        rendementNet: results.rendementNet,
        tauxVacance: inputs.tauxVacance ?? 0,
      });
    });
    return () => { cancelled = true; };
  }, [property.simulationId]);

  // ── Loyer actuel : priorite au "percu" du mois courant si des rent entries
  // existent pour ce mois, sinon on retombe sur la somme des incomes (valeur
  // attendue/theorique).
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const entriesCurrent = (rentEntries ?? []).filter((e) => e.yearMonth === currentYM);
  const entriesPrev = (rentEntries ?? []).filter((e) => e.yearMonth === prevYM);
  const loyerPercuCurrent = entriesCurrent.reduce((s, e) => s + e.loyerPercu, 0);
  const loyerAttenduCurrent = entriesCurrent.reduce((s, e) => s + e.loyerAttendu, 0);
  const loyerPercuPrev = entriesPrev.reduce((s, e) => s + e.loyerPercu, 0);
  const impayesCurrent = Math.max(0, loyerAttenduCurrent - loyerPercuCurrent);
  const nbLotsImpayes = entriesCurrent.filter(
    (e) => e.statut === "impaye" || e.statut === "partiel" || (e.loyerAttendu > 0 && e.loyerPercu < e.loyerAttendu),
  ).length;

  const revenuFromIncomes = incomes.reduce(
    (sum, i) => sum + mensualiserMontant(i.montant, i.frequence),
    0,
  );
  // Le "revenu mensuel actuel" = percu du mois si au moins une rent entry existe
  // pour ce mois; sinon la somme des incomes (cas pre-location / donnees non
  // encore saisies).
  const hasCurrentEntries = entriesCurrent.length > 0;
  // Revenu affiche dans la card = percu reel du mois (ou fallback incomes).
  const revenuMensuel = hasCurrentEntries ? loyerPercuCurrent : revenuFromIncomes;
  // Revenu a pleine occupation (SANS vacance). Quand egal au theorique,
  // vacance = 0 et la ligne "Optimum" n'a pas de sens (masquee).
  const revenuMensuelMaxEff = revenuMensuelMax && revenuMensuelMax > 0
    ? revenuMensuelMax
    : revenuFromIncomes;
  // Hierarchie de priorite pour le taux de vacance applique au "Theorique" :
  //   1. property.tauxVacanceGlobal (override utilisateur niveau bien) ← prevalence
  //   2. simKpis?.tauxVacance (defini dans la simulation initiale)
  //   3. fallback : taux moyen calcule depuis revenuMensuelTheorique vs Optimum
  //      (hierarchie precedente : tauxVacance par lot)
  const fallbackTauxVacance = revenuMensuelMaxEff > 0
    ? Math.max(0, 1 - (revenuMensuelTheorique ?? revenuFromIncomes) / revenuMensuelMaxEff)
    : 0;
  const tauxVacanceApplique = property.tauxVacanceGlobal != null
    ? property.tauxVacanceGlobal
    : (simKpis?.tauxVacance ?? fallbackTauxVacance);
  // Revenu CF = revenu pleine occupation × (1 − vacance applicable).
  // Reflet de la hierarchie ci-dessus (et non plus la prop revenuMensuelTheorique
  // qui n'avait pas connaissance de la simulation).
  const revenuMensuelCF = revenuMensuelMaxEff * (1 - tauxVacanceApplique);

  // Occupation : base sur les lots (statut "occupe"). Sans lots, fallback null.
  const totalLots = lots?.length ?? 0;
  const lotsOccupes = (lots ?? []).filter((l) => l.statut === "occupe").length;
  const tauxOccupation = totalLots > 0 ? (lotsOccupes / totalLots) * 100 : null;

  // Date du dernier paiement encaisse (rent entry la plus recente avec percu > 0).
  const lastPaidEntry = [...(rentEntries ?? [])]
    .filter((e) => e.loyerPercu > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
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

  // ── Gating sur le statut du bien ──
  // - Avant l'acte (prospection / offre / compromis) : le bien n'est pas encore
  //   a nous. Aucune charge ni credit ni loyer a compter dans l'actuel.
  // - Entre l'acte et la mise en location : charges + credit a payer, mais
  //   pas de revenu locatif.
  // - A partir de la mise en location : tout s'applique.
  // Les valeurs "theorique" restent pleines (elles projettent le regime de
  // croisiere quelle que soit la phase actuelle).
  const postActe = statusAtLeast(property.statut, "acte");
  const enLocation = statusAtLeast(property.statut, "location");
  const revenuActuelAffiche = enLocation ? revenuMensuel : 0;
  const depensesActuel = postActe ? depensesMensuelles : 0;
  const creditActuel = postActe ? creditMensuel : 0;

  // Cash flow "actuel" = base sur le revenu effectivement percu ce mois-ci.
  const cashFlow = revenuActuelAffiche - depensesActuel - creditActuel;

  // If loan has defer, compute the post-defer credit so we can show
  // "Theorique / Apres differe" as the secondary value. Le theorique
  // utilise le revenu a pleine occupation (revenuMensuelCF).
  const hasDiffere = loan != null && (loan.differeMois ?? 0) > 0;

  let creditPostDiffere = creditMensuel;
  let cashFlowPostDiffere = revenuMensuelCF - depensesMensuelles - creditMensuel;
  if (hasDiffere && loan) {
    creditPostDiffere = mensualiteAmortissement(loan) + loan.assuranceAnnuelle / 12;
    cashFlowPostDiffere = revenuMensuelCF - depensesMensuelles - creditPostDiffere;
  }

  const revenuAnnuel = incomes.reduce(
    (sum, i) => sum + annualiserMontant(i.montant, i.frequence),
    0
  );
  const chargesAnnuelles = expenses
    .filter((e) => e.categorie !== "credit")
    .reduce((sum, e) => sum + annualiserMontant(getCurrentMontant(e), e.frequence), 0);

  const coutTotal = coutTotalBien(property);
  // Rendement "Max" = sur la base des incomes bruts (equivaut a pleine
  // occupation sans vacance — comportement historique).
  const rBrut = rendementBrut(revenuAnnuel, coutTotal);
  const rNet = rendementNet(revenuAnnuel, chargesAnnuelles, coutTotal);
  // Rendement "Theorique" = revenus avec vacance appliquee (plus honnete).
  // Quand la vacance est nulle, ils sont egaux.
  const revenuAnnuelAvecVac = revenuMensuelCF * 12;
  const rBrutTheo = rendementBrut(revenuAnnuelAvecVac, coutTotal);
  const rNetTheo = rendementNet(revenuAnnuelAvecVac, chargesAnnuelles, coutTotal);

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

  // Depenses et CF "actuel" = ce qui est paye ce mois-ci (gates au statut)
  const depActuel = depensesActuel + creditActuel;
  const cfActuel = cashFlow;

  // Depenses et CF post-differe mais sur capital effectivement tire
  // (pertinent quand l'enveloppe travaux n'est pas entierement consommee).
  const showSurUtilise = creditApresDiffereSurUtilise != null
    && Math.round(creditApresDiffereSurUtilise) !== Math.round(creditPostDiffere);
  const depSurUtilise = showSurUtilise
    ? depensesMensuelles + creditApresDiffereSurUtilise!
    : depTheorique;
  const cfSurUtilise = showSurUtilise
    ? revenuMensuelCF - depSurUtilise
    : cfTheorique;

  // Cash flow "Max" = pleine occupation (revenu sans vacance).
  const cfMax = revenuMensuelMaxEff - depensesMensuelles - creditPostDiffere;
  // Affichage des lignes "Max" uniquement quand la vacance est > 0 quelque part.
  const eqRound = (a: number, b: number) => Math.round(a) === Math.round(b);
  const showMax = !eqRound(revenuMensuelMaxEff, revenuMensuelCF);

  const fc = formatCurrency;

  /** Renders a KPI card: Actuel (main), then small "Theorique" line.
   *  When the loan has a defer, the label becomes "Theorique / Apres differe"
   *  since the theoretical value IS the post-defer amount.
   *  Wrapped in a CfTooltip that shows the full breakdown on hover. */
  const KpiCard = ({ label, theoValue, actuelValue, surUtiliseValue, maxValue, simValue, color, tooltipRows }: {
    label: string;
    theoValue: number;
    actuelValue: number;
    surUtiliseValue?: number;
    maxValue?: number;
    simValue?: number;
    color?: (v: number) => string;
    tooltipRows: { label: string; value: string; bold?: boolean; color?: string; separator?: boolean }[];
  }) => {
    const cl = color ?? (() => "");
    const eq = (a: number, b: number) => Math.round(a) === Math.round(b);
    const showTheo = !eq(theoValue, actuelValue);
    const showSurUtil = surUtiliseValue != null && !eq(surUtiliseValue, theoValue) && !eq(surUtiliseValue, actuelValue);
    const showMaxLine = showExtended && maxValue != null && !eq(maxValue, theoValue);
    const showSimLine = showExtended && simValue != null;
    // L'asterisque indique que la valeur theorique applique le taux de vacance.
    // La legende est en-dessous du grid (voir bas du composant).
    const theoLabel = (hasDiffere ? "Theorique / Apres differe" : "Theorique")
      + (showMaxLine ? "*" : "");
    return (
      <CfTooltip rows={tooltipRows}>
        <Card className="border-dotted h-full">
          <CardContent className="p-3 flex flex-col h-full">
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
            {showSurUtil && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Sur capital utilise : </span>
                <span className={`font-medium ${cl(surUtiliseValue!)}`}>{fc(surUtiliseValue!)}</span>
              </p>
            )}
            {showMaxLine && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Optimum : </span>
                <span className={`font-medium ${cl(maxValue!)}`}>{fc(maxValue!)}</span>
              </p>
            )}
            {showSimLine && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Simulation initiale : </span>
                <span className={`font-medium ${cl(simValue!)}`}>{fc(simValue!)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </CfTooltip>
    );
  };

  return (
    <div className="space-y-2">
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {(() => {
        // Theorique = loyer avec vacance appliquee. Fallback sur les incomes
        // si aucun lot configure, pour que la ligne reste visible.
        const theo = revenuMensuelTheorique && revenuMensuelTheorique > 0
          ? revenuMensuelTheorique
          : revenuFromIncomes;
        const max = revenuMensuelMaxEff;
        const eq = (a: number, b: number) => Math.round(a) === Math.round(b);
        // Avant la mise en location, on force le revenu actuel a 0 mais on
        // garde la ligne "Theorique" visible pour projeter le regime cible.
        // Apres la mise en location, on n'affiche la ligne Theorique que si
        // elle differe du percu.
        const showTheo = theo > 0 && (!enLocation || !eq(theo, revenuActuelAffiche));
        const showMaxRev = max > 0 && !eq(max, theo);

        // ── Tooltip enrichi : breakdown par lot / income + contexte temporel ──
        const lotRows = (lots ?? []).map((l) => {
          const entry = entriesCurrent.find((e) => e.lotId === l.id);
          const value = entry
            ? `${fc(entry.loyerPercu)} / ${fc(entry.loyerAttendu)}`
            : fc(l.loyerMensuel);
          const color = entry && entry.loyerPercu < entry.loyerAttendu
            ? "text-destructive"
            : undefined;
          return { label: l.nom || "Lot", value, color };
        });
        const incomeRows = lotRows.length === 0
          ? incomes.map((i) => ({
              label: i.label || i.categorie,
              value: fc(mensualiserMontant(i.montant, i.frequence)),
            }))
          : [];
        const tooltipRows: { label: string; value: string; bold?: boolean; color?: string; separator?: boolean }[] = [
          ...lotRows,
          ...incomeRows,
          { separator: true, label: "", value: "" },
          { label: "Percu ce mois", value: fc(revenuMensuel), bold: true },
          ...(loyerAttenduCurrent > 0 && !eq(loyerAttenduCurrent, revenuMensuel)
            ? [{ label: "Attendu ce mois", value: fc(loyerAttenduCurrent) }]
            : []),
          ...(theo > 0 ? [{ label: "Theorique (avec vacance)", value: fc(theo) }] : []),
          ...(showMaxRev ? [{ label: "Max (pleine occupation)", value: fc(max) }] : []),
          ...(entriesPrev.length > 0
            ? [{ label: "Percu mois precedent", value: fc(loyerPercuPrev) }]
            : []),
          ...(lastPaidEntry
            ? [{ label: "Dernier encaissement", value: new Date(lastPaidEntry.updatedAt).toLocaleDateString("fr-FR") }]
            : []),
          ...(enLocation && tauxOccupation != null
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Occupation", value: `${tauxOccupation.toFixed(0)}% (${lotsOccupes}/${totalLots})` },
              ]
            : []),
          ...(enLocation && impayesCurrent > 0
            ? [{ label: "Impayes", value: `${fc(impayesCurrent)}${nbLotsImpayes > 0 ? ` (${nbLotsImpayes} lot${nbLotsImpayes > 1 ? "s" : ""})` : ""}`, color: "text-destructive" }]
            : []),
          ...(simKpis
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Simulation initiale", value: fc(simKpis.revenuMensuel) },
              ]
            : []),
        ];

        return (
          <CfTooltip rows={tooltipRows}>
            <Card className="border-dotted h-full">
              <CardContent className="p-3 flex flex-col h-full">
                <p className="text-xs text-muted-foreground">Revenu mensuel</p>
                <p className="text-lg font-bold">{fc(revenuActuelAffiche)}</p>
                {showTheo && (
                  <p className="text-[10px] mt-0.5">
                    <span className="text-muted-foreground">Theorique{showMaxRev ? "*" : ""} : </span>
                    <span className="font-medium">{fc(theo)}</span>
                  </p>
                )}
                {showExtended && showMaxRev && (
                  <p className="text-[10px] mt-0.5">
                    <span className="text-muted-foreground">Optimum : </span>
                    <span className="font-medium">{fc(max)}</span>
                  </p>
                )}
                {showExtended && simKpis && (
                  <p className="text-[10px] mt-0.5">
                    <span className="text-muted-foreground">Simulation initiale : </span>
                    <span className="font-medium">{fc(simKpis.revenuMensuel)}</span>
                  </p>
                )}
                {enLocation && impayesCurrent > 0 && (
                  <p className="text-[10px] mt-auto pt-1 text-destructive font-medium">
                    Impayes {fc(impayesCurrent)}
                    {nbLotsImpayes > 0 && ` (${nbLotsImpayes} lot${nbLotsImpayes > 1 ? "s" : ""})`}
                  </p>
                )}
              </CardContent>
            </Card>
          </CfTooltip>
        );
      })()}
      <KpiCard
        label="Depenses mensuelles"
        theoValue={depTheorique}
        actuelValue={depActuel}
        surUtiliseValue={showSurUtilise ? depSurUtilise : undefined}
        simValue={simKpis?.depensesMensuellesTotal}
        tooltipRows={[
          { label: "Charges (hors credit)", value: fc(depensesActuel) },
          { label: hasDiffere ? "Credit (ce mois)" : "Credit", value: fc(creditActuel) },
          { separator: true, label: "", value: "" },
          { label: "Total actuel", value: fc(depActuel), bold: true },
          ...(!postActe
            ? [{ label: "Acte non signe : pas de charges dues", value: "" }]
            : []),
          ...(hasDiffere
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Credit apres differe", value: fc(creditPostDiffere) },
                { label: "Total theorique", value: fc(depTheorique), bold: true },
              ]
            : []),
          ...(showSurUtilise
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Credit sur capital utilise", value: fc(creditApresDiffereSurUtilise!) },
                { label: "Apres differe sur capital utilise", value: fc(depSurUtilise), bold: true },
              ]
            : []),
          ...(simKpis
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Simulation initiale", value: fc(simKpis.depensesMensuellesTotal) },
              ]
            : []),
        ]}
      />
      <KpiCard
        label="Cash flow mensuel"
        theoValue={cfTheorique}
        actuelValue={cfActuel}
        surUtiliseValue={showSurUtilise ? cfSurUtilise : undefined}
        maxValue={showMax ? cfMax : undefined}
        simValue={simKpis?.cashFlowMensuel}
        color={(v) => v >= 0 ? "text-green-600" : "text-destructive"}
        tooltipRows={[
          { label: "Revenus (percu)", value: fc(revenuActuelAffiche), color: "text-green-600" },
          { label: "Charges (hors credit)", value: `-${fc(depensesActuel)}`, color: "text-amber-600" },
          { label: hasDiffere ? "Credit (ce mois)" : "Credit", value: `-${fc(creditActuel)}`, color: "text-amber-600" },
          { separator: true, label: "", value: "" },
          { label: "Cash flow actuel", value: fc(cfActuel), bold: true },
          ...(!postActe
            ? [{ label: "Acte non signe : aucun flux actuel", value: "" }]
            : !enLocation
            ? [{ label: "Pas encore en location", value: "" }]
            : []),
          { separator: true as const, label: "", value: "" },
          { label: "Revenus (theorique)", value: fc(revenuMensuelCF), color: "text-green-600" },
          ...(hasDiffere
            ? [
                { label: "Credit apres differe", value: `-${fc(creditPostDiffere)}`, color: "text-amber-600" },
              ]
            : []),
          { label: "Cash flow theorique", value: fc(cfTheorique), bold: true },
          ...(showMax
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Revenus (max, sans vacance)", value: fc(revenuMensuelMaxEff), color: "text-green-600" },
                { label: "Cash flow max", value: fc(cfMax), bold: true },
              ]
            : []),
          ...(showSurUtilise
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Credit sur capital utilise", value: `-${fc(creditApresDiffereSurUtilise!)}`, color: "text-amber-600" },
                { label: "Apres differe sur capital utilise", value: fc(cfSurUtilise), bold: true },
              ]
            : []),
          ...(simKpis
            ? [
                { separator: true as const, label: "", value: "" },
                { label: "Simulation initiale", value: fc(simKpis.cashFlowMensuel) },
              ]
            : []),
        ]}
      />
      <CfTooltip rows={[
        { label: "Loyer annuel (avec vacance)", value: fc(revenuAnnuelAvecVac) },
        { label: "Cout total du projet", value: fc(coutTotal) },
        { separator: true, label: "", value: "" },
        { label: "Rendement theorique", value: formatPercent(rBrutTheo), bold: true },
        ...(showMax
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Loyer annuel (pleine occ.)", value: fc(revenuMensuelMaxEff * 12) },
              { label: "Rendement max", value: formatPercent(rBrut), bold: true },
            ]
          : []),
        ...(showUtilise
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Capital utilise actuel", value: fc(capitalUtiliseActuel!) },
              { label: "Sur capital utilise", value: formatPercent(rBrutUtilise), bold: true },
            ]
          : []),
        ...(simKpis
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Simulation initiale", value: formatPercent(simKpis.rendementBrut) },
            ]
          : []),
      ]}>
        <Card className="border-dotted h-full">
          <CardContent className="p-3 flex flex-col h-full">
            <p className="text-xs text-muted-foreground">Rendement brut</p>
            <p className="text-lg font-bold">{formatPercent(rBrutTheo)}</p>
            {showExtended && showMax && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Optimum : </span>
                <span className="font-medium">{formatPercent(rBrut)}</span>
              </p>
            )}
            {showUtilise && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Sur capital utilise : </span>
                <span className="font-medium">{formatPercent(rBrutUtilise)}</span>
              </p>
            )}
            {showExtended && simKpis && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Simulation initiale : </span>
                <span className="font-medium">{formatPercent(simKpis.rendementBrut)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </CfTooltip>
      <CfTooltip rows={[
        { label: "Loyer annuel (avec vacance)", value: fc(revenuAnnuelAvecVac) },
        { label: "Charges annuelles", value: `-${fc(chargesAnnuelles)}`, color: "text-amber-600" },
        { label: "Cout total du projet", value: fc(coutTotal) },
        { separator: true, label: "", value: "" },
        { label: "Rendement theorique", value: formatPercent(rNetTheo), bold: true },
        ...(showMax
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Loyer annuel (pleine occ.)", value: fc(revenuMensuelMaxEff * 12) },
              { label: "Rendement max", value: formatPercent(rNet), bold: true },
            ]
          : []),
        ...(showUtilise
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Capital utilise actuel", value: fc(capitalUtiliseActuel!) },
              { label: "Sur capital utilise", value: formatPercent(rNetUtilise), bold: true },
            ]
          : []),
        ...(simKpis
          ? [
              { separator: true as const, label: "", value: "" },
              { label: "Simulation initiale", value: formatPercent(simKpis.rendementNet) },
            ]
          : []),
      ]}>
        <Card className="border-dotted h-full">
          <CardContent className="p-3 flex flex-col h-full">
            <p className="text-xs text-muted-foreground">Rendement net</p>
            <p className="text-lg font-bold">{formatPercent(rNetTheo)}</p>
            {showExtended && showMax && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Optimum : </span>
                <span className="font-medium">{formatPercent(rNet)}</span>
              </p>
            )}
            {showUtilise && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Sur capital utilise : </span>
                <span className="font-medium">{formatPercent(rNetUtilise)}</span>
              </p>
            )}
            {showExtended && simKpis && (
              <p className="text-[10px] mt-0.5">
                <span className="text-muted-foreground">Simulation initiale : </span>
                <span className="font-medium">{formatPercent(simKpis.rendementNet)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </CfTooltip>
    </div>

    {/* Toggle pour etendre les cards avec Optimum + Simulation initiale */}
    {(simKpis || revenuMensuelMaxEff !== revenuMensuelCF) && (
      <button
        type="button"
        onClick={() => setShowExtended((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-[10px] text-destructive/60 hover:text-destructive transition-colors select-none cursor-pointer"
        aria-expanded={showExtended}
      >
        <span className={`inline-flex items-center justify-center w-3 h-3 text-[10px] leading-none transition-transform ${showExtended ? "rotate-90" : ""}`}>▸</span>
        {showExtended ? "Masquer Optimum / Simulation initiale" : "Afficher Optimum / Simulation initiale"}
      </button>
    )}

    {/* Legende sur l'asterisque (Theorique avec vacance) */}
    {tauxVacanceApplique > 0.001 && (
      <p className="text-[10px] text-muted-foreground italic mt-1">
        * Le revenu theorique prend en compte une vacance locative de {(tauxVacanceApplique * 100).toFixed(1)} %.
      </p>
    )}

    {/* Bouton "Information" qui revele les definitions en grille 2 colonnes. */}
    {(() => {
      const defs: { label: string; desc: string }[] = [
        { label: "Actuel", desc: "Loyer percu, charges payees et mensualite credit en cours ce mois-ci." },
        { label: "Theorique", desc: "Regime de croisiere : loyers a pleine occupation ajustes par la vacance, credit post-differe." },
      ];
      if (showMax) defs.push({ label: "Optimum", desc: "Meilleur cas theorique, 100% d'occupation (sans vacance). Le Theorique applique la vacance configuree." });
      if (showSurUtilise) defs.push({ label: "Sur capital utilise", desc: "Recalcule sur le capital reellement tire (principal moins les travaux non encore tires)." });
      if (hasDiffere) defs.push({ label: "Apres differe", desc: "Mensualite d'amortissement une fois le differe termine." });
      if (simKpis) defs.push({ label: "Simulation initiale", desc: "Valeur projetee par la simulation dont ce bien est issu (annee 1)." });
      return (
        <Tooltip>
          <TooltipTrigger render={
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors select-none cursor-help"
            />
          }>
            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-current text-[9px] leading-none">?</span>
            Information
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="z-[100] bg-background text-foreground border border-dotted border-muted-foreground/30 shadow-lg p-3 w-[90vw] max-w-2xl"
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
              {defs.map((d) => (
                <div key={d.label} className="space-y-0.5">
                  <div className="font-bold">{d.label}</div>
                  <div className="text-muted-foreground leading-snug">{d.desc}</div>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    })()}
    </div>
  );
}
