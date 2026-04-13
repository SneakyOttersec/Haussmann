"use client";

import { useState, useMemo } from "react";
import type { CalculatorResults as Results, CalculatorInputs, Associe } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { calculerTRI } from "@/lib/calculations/irr";
import { plusValueSortie } from "@/lib/calculations/regimes";
import { toRegimeFiscalType } from "@/types";

interface CalculatorResultsProps {
  results: Results;
  inputs?: CalculatorInputs;
  associes?: Associe[];
  differePretMois?: number;
}

function eur(v: number): string {
  return formatCurrency(v);
}

interface KpiTooltip {
  formula: string;
  applied: string;
}

function Kpi({ label, value, accent, tooltip }: {
  label: string; value: string; accent?: "positive" | "negative"; tooltip?: KpiTooltip;
}) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="text-center relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 cursor-help">{label}</p>
      <p className={`text-lg font-bold leading-tight ${
        accent === "positive" ? "text-green-600" : accent === "negative" ? "text-destructive" : ""
      }`}>
        {value}
      </p>
      {tooltip && show && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-white border border-dotted rounded-lg shadow-lg p-3 text-left">
          <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Formule</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{tooltip.formula}</p>
          <hr className="my-2 border-dashed border-muted-foreground/20" />
          <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Calcul applique</p>
          <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-line font-mono">{tooltip.applied}</p>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${color ?? ""}`}>{value}</span>
    </div>
  );
}

export function CalculatorResultsPanel({ results, inputs, associes, differePretMois }: CalculatorResultsProps) {
  // cfSign recalcule plus bas a partir de avgCashFlowApresImpot (duree du credit).
  const r = results;
  const [triAnnee, setTriAnnee] = useState(10);
  const [showTriTooltip, setShowTriTooltip] = useState(false);
  const [showTriProjetTooltip, setShowTriProjetTooltip] = useState(false);

  // Pre-calcule l'impot sur la plus-value a la revente pour l'horizon choisi
  // afin d'inclure cette charge dans le TRI investisseur (alignement avec la
  // comparaison fiscale).
  const impotPVSortie = useMemo(() => {
    if (!inputs) return 0;
    const n = Math.min(triAnnee, r.projection.length);
    if (n < 1) return 0;
    const last = r.projection[n - 1];
    if (!last) return 0;
    const regime = toRegimeFiscalType(inputs.regimeFiscal);
    const fraisNotaire = inputs.prixAchat * inputs.fraisNotairePct;
    // Pour IS/LMNP reel, on a besoin du cumul d'amortissement a la sortie.
    // Approximation : cumul = somme des amortissements sur les annees projetees.
    // YearProjection n'expose pas l'amort par annee — on utilise 0 en fallback
    // pour IR (pas de reintegration) et la methode simple pour IS/LMNP.
    const amortCumule = (regime === "is" || regime === "lmnp_reel")
      ? (inputs.prixAchat * 0.80 / 30) * n + (inputs.montantTravaux / 18) * n + (inputs.montantMobilierTotal / 7) * n
      : 0;
    const pv = plusValueSortie(
      regime,
      inputs.prixAchat,
      inputs.montantTravaux,
      fraisNotaire,
      last.valeurBien,
      amortCumule,
      n,
    );
    return pv.impotPV;
  }, [inputs, r.projection, triAnnee]);

  // Cash flow mensuel moyen sur toute la duree du credit (pas seulement A1).
  // Intègre le differe (ou sa mensualite plus basse) et les annees d'amortissement
  // complet, ce qui donne une vue plus fiable qu'A1 qui est souvent trompeur
  // (differe = interets seuls).
  const loanTotalYears = useMemo(() => {
    if (!inputs) return 0;
    const dM = inputs.differePretMois ?? 0;
    const totalMois = inputs.dureeCredit * 12 + (inputs.differePretInclus ? 0 : dM);
    return Math.ceil(totalMois / 12);
  }, [inputs]);

  const avgCashFlowApresImpot = useMemo(() => {
    const n = Math.min(loanTotalYears || r.projection.length, r.projection.length);
    if (n < 1) return { annuel: 0, mensuel: 0, years: 0, avantImpotAnnuel: 0, avantImpotMensuel: 0, impotMoyen: 0 };
    let sum = 0;
    let sumAvant = 0;
    let sumImpot = 0;
    for (let i = 0; i < n; i++) {
      sum += r.projection[i]?.cashFlowApresImpot ?? 0;
      sumAvant += r.projection[i]?.cashFlowAvantImpot ?? 0;
      sumImpot += r.projection[i]?.impot ?? 0;
    }
    return {
      annuel: sum / n,
      mensuel: sum / n / 12,
      years: n,
      avantImpotAnnuel: sumAvant / n,
      avantImpotMensuel: sumAvant / n / 12,
      impotMoyen: sumImpot / n,
    };
  }, [r.projection, loanTotalYears]);

  const triCustom = useMemo(() => {
    const n = Math.min(triAnnee, r.projection.length);
    if (n < 1) return 0;
    const cfs: number[] = [-r.apportPersonnel];
    for (let i = 0; i < n; i++) {
      const p = r.projection[i];
      if (i < n - 1) {
        cfs.push(p.cashFlowApresImpot);
      } else {
        // Revente : deduction de l'impot sur la plus-value (cohereent avec
        // la comparaison fiscale).
        cfs.push(p.cashFlowApresImpot + p.valeurBien - p.capitalRestantDu - impotPVSortie);
      }
    }
    return calculerTRI(cfs);
  }, [r, triAnnee, impotPVSortie]);

  const triProjet = useMemo(() => {
    const n = Math.min(triAnnee, r.projection.length);
    if (n < 1) return 0;
    const cfs: number[] = [-r.coutTotalAcquisition];
    for (let i = 0; i < n; i++) {
      const p = r.projection[i];
      const noi = p.loyerNet - p.charges;
      if (i < n - 1) {
        cfs.push(noi);
      } else {
        cfs.push(noi + p.valeurBien);
      }
    }
    return calculerTRI(cfs);
  }, [r, triAnnee]);

  const tooltips: Record<string, KpiTooltip> = {
    rdtBrut: {
      formula: "Loyer annuel brut\n/ Cout total d'acquisition\n× 100",
      applied: `${eur(r.loyerAnnuelBrut)}\n/ ${eur(r.coutTotalAcquisition)}\n= ${formatPercent(r.rendementBrut)}`,
    },
    rdtNet: {
      formula: "(Loyer annuel net - Charges annuelles)\n/ Cout total d'acquisition\n× 100",
      applied: `(${eur(r.loyerAnnuelNet)} - ${eur(r.chargesAnnuellesTotales)})\n/ ${eur(r.coutTotalAcquisition)}\n= ${eur(r.loyerAnnuelNet - r.chargesAnnuellesTotales)} / ${eur(r.coutTotalAcquisition)}\n= ${formatPercent(r.rendementNet)}`,
    },
    cashFlow: {
      formula: `Moyenne du cash flow apres impot\nsur toute la duree du credit\n(${avgCashFlowApresImpot.years} ans, incluant differe et amortissement).\n\n= somme(cashFlowApresImpot annuel)\n  / nb annees / 12`,
      applied: `Somme CF apres impot: ${eur(avgCashFlowApresImpot.annuel * avgCashFlowApresImpot.years)}\nSur ${avgCashFlowApresImpot.years} ans\n= ${eur(avgCashFlowApresImpot.annuel)}/an\n= ${formatCurrency(avgCashFlowApresImpot.mensuel)}/mois (moyenne)`,
    },
    taeg: {
      formula: "Taux annuel effectif global\n= Taux nominal + cout assurance\ncalcule par methode actuarielle\n(Newton-Raphson)",
      applied: `Mensualite totale: ${formatCurrency(r.mensualiteCredit, true)}/mois\nTAEG = ${formatPercent(r.taeg)}`,
    },
    triInvestisseur: {
      formula: `Avec levier (point de vue associe)\n\nMise de depart = apport personnel\nFlux annuels = cash flow apres impot\nSortie A${triAnnee} = cash flow + (valeur bien − dette restante) − impot sur la plus-value`,
      applied: `Mise de depart: ${eur(r.apportPersonnel)}\nFlux an 1: ${eur(r.projection[0]?.cashFlowApresImpot ?? 0)}\nValeur bien A${triAnnee}: ${eur(r.projection[triAnnee - 1]?.valeurBien ?? 0)}\n− Dette restante: ${eur(r.projection[triAnnee - 1]?.capitalRestantDu ?? 0)}\n− Impot plus-value: ${eur(impotPVSortie)}\n\n→ TRI = ${formatPercent(triCustom)}`,
    },
    triProjet: {
      formula: `Sans levier (rentabilite du bien)\n\nMise de depart = cout total acquisition\nFlux annuels = loyers nets - charges\nSortie = flux + revente du bien`,
      applied: `Mise de depart: ${eur(r.coutTotalAcquisition)}\nFlux an 1: ${eur((r.projection[0]?.loyerNet ?? 0) - (r.projection[0]?.charges ?? 0))}\nRevente A${triAnnee}: ${eur(r.projection[triAnnee - 1]?.valeurBien ?? 0)}\n\n→ TRI = ${formatPercent(triProjet)}`,
    },
  };

  return (
    <div className="space-y-5">
      {/* KPI band */}
      <div className="border border-dotted rounded-lg p-5">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          <Kpi label="Rdt brut" value={formatPercent(r.rendementBrut)} tooltip={tooltips.rdtBrut} />
          <Kpi label="Rdt net" value={formatPercent(r.rendementNet)} tooltip={tooltips.rdtNet} />
          <Kpi
            label="Cash flow/m (moy.)"
            value={formatCurrency(avgCashFlowApresImpot.mensuel)}
            accent={avgCashFlowApresImpot.mensuel >= 0 ? "positive" : "negative"}
            tooltip={tooltips.cashFlow}
          />
          <Kpi label="TAEG" value={formatPercent(r.taeg)} tooltip={tooltips.taeg} />
          <div className="text-center col-span-2">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">TRI</p>
              <select
                value={triAnnee}
                onChange={(e) => setTriAnnee(Number(e.target.value))}
                className="text-[10px] bg-transparent text-muted-foreground outline-none cursor-pointer"
              >
                {[5, 10, 15, 20, 25].filter((y) => y <= r.projection.length).map((y) => (
                  <option key={y} value={y}>{y} ans</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative"
                onMouseEnter={() => setShowTriTooltip(true)}
                onMouseLeave={() => setShowTriTooltip(false)}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 cursor-help">Investisseur</p>
                <p className={`text-lg font-bold leading-tight ${triCustom > 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatPercent(triCustom)}
                </p>
                {showTriTooltip && tooltips.triInvestisseur && (
                  <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-white border border-dotted rounded-lg shadow-lg p-3 text-left">
                    <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Formule</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{tooltips.triInvestisseur.formula}</p>
                    <hr className="my-2 border-dashed border-muted-foreground/20" />
                    <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Calcul applique</p>
                    <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-line font-mono">{tooltips.triInvestisseur.applied}</p>
                  </div>
                )}
              </div>
              <div className="relative"
                onMouseEnter={() => setShowTriProjetTooltip(true)}
                onMouseLeave={() => setShowTriProjetTooltip(false)}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 cursor-help">Projet</p>
                <p className={`text-lg font-bold leading-tight ${triProjet > 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatPercent(triProjet)}
                </p>
                {showTriProjetTooltip && tooltips.triProjet && (
                  <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-white border border-dotted rounded-lg shadow-lg p-3 text-left">
                    <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Formule</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{tooltips.triProjet.formula}</p>
                    <hr className="my-2 border-dashed border-muted-foreground/20" />
                    <p className="text-[10px] uppercase tracking-wider text-teal font-bold mb-1.5">Calcul applique</p>
                    <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-line font-mono">{tooltips.triProjet.applied}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail breakdown */}
      <div className="border border-dotted rounded-lg p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3">Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <DetailRow label="Cout total acquisition" value={formatCurrency(r.coutTotalAcquisition)} />
            <DetailRow label="Apport personnel" value={formatCurrency(r.apportPersonnel)} />
            <DetailRow label="Loyer annuel brut" value={formatCurrency(r.loyerAnnuelBrut)} />
            <DetailRow label="Loyer annuel net (avec vacance locative)" value={formatCurrency(r.loyerAnnuelNet)} />
            <DetailRow label="Charges annuelles" value={formatCurrency(r.chargesAnnuellesTotales)} />
          </div>
          <div>
            {differePretMois && differePretMois > 0 ? (
              <>
                <DetailRow
                  label={`Mensualite pendant differe (${differePretMois}m)`}
                  value={formatCurrency(r.projection[0]?.mensualitesCredit ? r.projection[0].mensualitesCredit / 12 : 0, true)}
                />
                <DetailRow
                  label="Mensualite post-differe"
                  value={formatCurrency(r.mensualiteCredit, true)}
                />
              </>
            ) : (
              <DetailRow label="Mensualite (credit + assurance)" value={formatCurrency(r.mensualiteCredit, true)} />
            )}
            <DetailRow
              label={`Cash flow mensuel avant impot (moy. ${avgCashFlowApresImpot.years}a)`}
              value={formatCurrency(avgCashFlowApresImpot.avantImpotMensuel)}
            />
            <DetailRow
              label={`Impot annuel moyen (${avgCashFlowApresImpot.years}a)`}
              value={formatCurrency(avgCashFlowApresImpot.impotMoyen)}
            />
            <DetailRow
              label={`Cash flow annuel apres impot (moy. ${avgCashFlowApresImpot.years}a)`}
              value={formatCurrency(avgCashFlowApresImpot.annuel)}
              color={avgCashFlowApresImpot.annuel >= 0 ? "text-green-600" : "text-destructive"}
            />
          </div>
        </div>
      </div>

      {/* Repartition associes */}
      {associes && associes.length > 1 && (
        <div className="border border-dotted rounded-lg p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider mb-3">Repartition associes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dashed border-muted-foreground/20">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium"></th>
                  {associes.map((a) => (
                    <th key={a.id} className="text-right py-2 px-3 font-medium">
                      {a.nom} <span className="text-muted-foreground font-normal">({a.quotePart}%)</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Apport personnel", value: r.apportPersonnel },
                  { label: `Cash flow mensuel moyen (${avgCashFlowApresImpot.years}a)`, value: avgCashFlowApresImpot.mensuel, color: true },
                  { label: `Cash flow annuel moyen (${avgCashFlowApresImpot.years}a)`, value: avgCashFlowApresImpot.annuel, color: true },
                  { label: `Impot annuel moyen (${avgCashFlowApresImpot.years}a)`, value: avgCashFlowApresImpot.impotMoyen },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-dashed border-muted-foreground/10">
                    <td className="py-1.5 pr-4 text-muted-foreground">{row.label}</td>
                    {associes.map((a) => {
                      const part = row.value * a.quotePart / 100;
                      return (
                        <td key={a.id} className={`py-1.5 px-3 text-right tabular-nums font-medium ${
                          row.color ? (part >= 0 ? "text-green-600" : "text-destructive") : ""
                        }`}>
                          {formatCurrency(part)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
