"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Property, Expense, Income, LoanDetails, RentMonthEntry, PropertyStatus } from "@/types";
import { PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS, PROPERTY_STATUS_ORDER } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { getCurrentMontant } from "@/lib/expenseRevisions";
import { buildMonthlyFlow, computeCashflowStats, computeTheoreticalMonthlyCashflow } from "@/lib/monthlyFlow";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PropertyCardProps {
  property: Property;
  expenses: Expense[];
  incomes: Income[];
  rentEntries: RentMonthEntry[];
  loan?: LoanDetails | null;
  onDelete?: (id: string) => void;
}

function isPostActe(statut?: PropertyStatus): boolean {
  if (!statut) return true;
  return PROPERTY_STATUS_ORDER.indexOf(statut) >= PROPERTY_STATUS_ORDER.indexOf("acte");
}

function isEnLocation(statut?: PropertyStatus): boolean {
  if (!statut) return true;
  return PROPERTY_STATUS_ORDER.indexOf(statut) >= PROPERTY_STATUS_ORDER.indexOf("location");
}

export function PropertyCard({ property, expenses, incomes, rentEntries, loan, onDelete }: PropertyCardProps) {
  const router = useRouter();
  const postActe = isPostActe(property.statut);
  const enLocation = isEnLocation(property.statut);

  const stats = useMemo(() => {
    if (!postActe) return { global: 0, lastMonth: 0, last6Months: null, nbMois: 0 };
    const monthly = buildMonthlyFlow(property, incomes, expenses, rentEntries, loan ?? null);
    return computeCashflowStats(monthly);
  }, [property, incomes, expenses, rentEntries, loan, postActe]);

  const cfTheorique = useMemo(
    () => computeTheoreticalMonthlyCashflow(incomes, expenses),
    [incomes, expenses],
  );

  // Breakdown for tooltip
  const { revenusMensuel, depensesMensuel, creditMensuel } = useMemo(() => {
    const mensualise = (montant: number, freq: string) => {
      if (freq === "mensuel") return montant;
      if (freq === "trimestriel") return montant / 3;
      if (freq === "annuel") return montant / 12;
      return 0;
    };
    const rev = incomes.reduce((s, i) => s + mensualise(i.montant, i.frequence), 0);
    const dep = expenses.filter(e => e.categorie !== "credit").reduce((s, e) => s + mensualise(getCurrentMontant(e), e.frequence), 0);
    const cred = expenses.filter(e => e.categorie === "credit").reduce((s, e) => s + mensualise(getCurrentMontant(e), e.frequence), 0);
    return { revenusMensuel: rev, depensesMensuel: dep, creditMensuel: cred };
  }, [incomes, expenses]);

  const cfClass = (v: number) => (v >= 0 ? "text-green-600" : "text-destructive");

  return (
    <Link href={`/biens?id=${property.id}`}>
      <Card className="group border border-muted-foreground/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{property.nom}</h3>
            <div className="flex items-center gap-1.5">
              {property.statut && property.statut !== "exploitation" && (
                <Badge variant="outline" className="text-[10px]">{PROPERTY_STATUS_LABELS[property.statut]}</Badge>
              )}
              <Badge variant="secondary" className="text-xs">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(property.id);
                  }}
                  className="text-destructive/30 hover:text-destructive text-sm transition-colors"
                  title="Supprimer ce bien"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground truncate">{property.adresse}</p>
            <span className="text-[10px] text-muted-foreground/0 group-hover:text-primary transition-colors ml-2 shrink-0">Voir →</span>
          </div>
          <div className={`grid ${postActe ? 'grid-cols-4' : 'grid-cols-1'} gap-2 text-xs mb-3`}>
            <div title={`Revenus : ${formatCurrency(revenusMensuel)}/m\nCharges : -${formatCurrency(depensesMensuel)}/m\nCredit : -${formatCurrency(creditMensuel)}/m\n= CF : ${formatCurrency(cfTheorique)}/m`}>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">CF theorique</p>
              <p className={`font-bold ${cfClass(cfTheorique)}`}>{formatCurrency(cfTheorique)}</p>
              <p className="text-[9px] text-muted-foreground">/mois</p>
            </div>
            {postActe && (
              <>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">CF global</p>
                  <p className={`font-bold ${cfClass(stats.global)}`}>{formatCurrency(stats.global)}</p>
                  <p className="text-[9px] text-muted-foreground">{stats.nbMois} mois</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Mois dernier</p>
                  <p className={`font-bold ${cfClass(stats.lastMonth)}`}>{formatCurrency(stats.lastMonth)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">6 derniers</p>
                  {stats.last6Months !== null ? (
                    <p className={`font-bold ${cfClass(stats.last6Months)}`}>{formatCurrency(stats.last6Months)}</p>
                  ) : (
                    <p className="font-bold text-muted-foreground/50">N/A</p>
                  )}
                </div>
              </>
            )}
          </div>
          {enLocation ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/loyers?propertyId=${property.id}`);
              }}
              className="text-[11px] text-muted-foreground hover:text-primary border-t border-dashed border-muted-foreground/15 pt-2 -mx-4 px-4 transition-colors text-left w-full block"
            >
              Suivi des loyers →
            </button>
          ) : (
            <div className="text-[11px] text-muted-foreground/40 border-t border-dashed border-muted-foreground/15 pt-2 -mx-4 px-4">
              Suivi des loyers disponible a partir de la mise en location
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
