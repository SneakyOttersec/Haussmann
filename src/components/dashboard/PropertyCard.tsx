"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Property, Expense, Income, RentMonthEntry } from "@/types";
import { PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { buildMonthlyFlow, computeCashflowStats, computeTheoreticalMonthlyCashflow } from "@/lib/monthlyFlow";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PropertyCardProps {
  property: Property;
  expenses: Expense[];
  incomes: Income[];
  rentEntries: RentMonthEntry[];
  onDelete?: (id: string) => void;
}

export function PropertyCard({ property, expenses, incomes, rentEntries, onDelete }: PropertyCardProps) {
  const router = useRouter();

  const stats = useMemo(() => {
    const monthly = buildMonthlyFlow(property, incomes, expenses, rentEntries);
    return computeCashflowStats(monthly);
  }, [property, incomes, expenses, rentEntries]);

  const cfTheorique = useMemo(
    () => computeTheoreticalMonthlyCashflow(incomes, expenses),
    [incomes, expenses],
  );

  const cfClass = (v: number) => (v >= 0 ? "text-green-600" : "text-destructive");

  return (
    <Link href={`/biens?id=${property.id}`}>
      <Card className="border-dotted hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-sm">{property.nom}</h3>
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
          <p className="text-xs text-muted-foreground mb-3 truncate">{property.adresse}</p>
          <div className="grid grid-cols-4 gap-2 text-xs mb-3">
            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">CF theorique</p>
              <p className={`font-bold ${cfClass(cfTheorique)}`}>{formatCurrency(cfTheorique)}</p>
              <p className="text-[9px] text-muted-foreground">/mois</p>
            </div>
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
          </div>
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
        </CardContent>
      </Card>
    </Link>
  );
}
