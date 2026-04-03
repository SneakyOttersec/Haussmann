"use client";

import Link from "next/link";
import type { Property, Expense, Income } from "@/types";
import { PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS } from "@/types";
import { formatCurrency, mensualiserMontant } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PropertyCardProps {
  property: Property;
  expenses: Expense[];
  incomes: Income[];
  onDelete?: (id: string) => void;
}

export function PropertyCard({ property, expenses, incomes, onDelete }: PropertyCardProps) {
  const revenuMensuel = incomes.reduce(
    (sum, i) => sum + mensualiserMontant(i.montant, i.frequence),
    0
  );
  const depensesMensuelles = expenses.reduce(
    (sum, e) => sum + mensualiserMontant(e.montant, e.frequence),
    0
  );
  const cashFlow = revenuMensuel - depensesMensuelles;

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
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Revenus</p>
              <p className="font-bold">{formatCurrency(revenuMensuel)}/m</p>
            </div>
            <div>
              <p className="text-muted-foreground">Depenses</p>
              <p className="font-bold">{formatCurrency(depensesMensuelles)}/m</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cash flow</p>
              <p className={`font-bold ${cashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(cashFlow)}/m
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
