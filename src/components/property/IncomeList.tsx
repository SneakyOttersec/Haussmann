"use client";

import type { Income } from "@/types";
import { INCOME_CATEGORY_LABELS, FREQUENCY_LABELS } from "@/types";
import { formatCurrency, annualiserMontant } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface IncomeListProps {
  incomes: Income[];
  onDelete: (id: string) => void;
}

export function IncomeList({ incomes, onDelete }: IncomeListProps) {
  if (incomes.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Aucun revenu enregistre.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Categorie</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead>Frequence</TableHead>
          <TableHead className="text-right">Annualise</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incomes.map((income) => (
          <TableRow key={income.id}>
            <TableCell className="font-medium">{income.label}</TableCell>
            <TableCell className="text-muted-foreground">{INCOME_CATEGORY_LABELS[income.categorie]}</TableCell>
            <TableCell className="text-right">{formatCurrency(income.montant)}</TableCell>
            <TableCell>{FREQUENCY_LABELS[income.frequence]}</TableCell>
            <TableCell className="text-right">
              {income.frequence !== "ponctuel"
                ? formatCurrency(annualiserMontant(income.montant, income.frequence))
                : "—"}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(income.id)}
                className="text-destructive hover:text-destructive"
              >
                ×
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
