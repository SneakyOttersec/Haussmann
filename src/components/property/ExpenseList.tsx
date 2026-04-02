"use client";

import type { Expense } from "@/types";
import { EXPENSE_CATEGORY_LABELS, FREQUENCY_LABELS, EXPENSE_GROUPS } from "@/types";
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

interface ExpenseListProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
}

export function ExpenseList({ expenses, onDelete }: ExpenseListProps) {
  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Aucune depense enregistree.</p>;
  }

  return (
    <div className="space-y-4">
      {Object.entries(EXPENSE_GROUPS).map(([groupLabel, categories]) => {
        const groupExpenses = expenses.filter((e) => categories.includes(e.categorie));
        if (groupExpenses.length === 0) return null;

        return (
          <div key={groupLabel}>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{groupLabel}</h3>
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
                {groupExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.label}</TableCell>
                    <TableCell className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[expense.categorie]}</TableCell>
                    <TableCell className="text-right">{formatCurrency(expense.montant)}</TableCell>
                    <TableCell>{FREQUENCY_LABELS[expense.frequence]}</TableCell>
                    <TableCell className="text-right">
                      {expense.frequence !== "ponctuel"
                        ? formatCurrency(annualiserMontant(expense.montant, expense.frequence))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(expense.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        ×
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
