"use client";

import { useMemo } from "react";
import type { Expense } from "@/types";
import { EXPENSE_CATEGORY_LABELS } from "@/types";
import { formatCurrency, annualiserMontant } from "@/lib/utils";
import { getMontantForYear } from "@/lib/expenseRevisions";

interface Props {
  expenses: Expense[];
  years: number[];
}

export function ExpenseEvolutionTable({ expenses, years }: Props) {
  const sortedYears = [...years].sort((a, b) => a - b);

  // Row = expense, Columns = years, Cell = annualized effective montant
  const rows = useMemo(() => {
    return expenses
      .filter((e) => e.frequence !== "ponctuel")
      .map((e) => {
        const values = sortedYears.map((y) => {
          const montant = getMontantForYear(e, y);
          return annualiserMontant(montant, e.frequence);
        });
        // Compute delta vs first year
        const first = values[0] || 0;
        const last = values[values.length - 1] || 0;
        const deltaPct = first > 0 ? ((last - first) / first) * 100 : 0;
        return { expense: e, values, deltaPct };
      });
  }, [expenses, sortedYears]);

  // Totals per year
  const totals = useMemo(() => {
    return sortedYears.map((_, idx) =>
      rows.reduce((s, r) => s + r.values[idx], 0),
    );
  }, [sortedYears, rows]);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Aucune depense recurrente.</p>;
  }

  const totalFirst = totals[0] || 0;
  const totalLast = totals[totals.length - 1] || 0;
  const totalDeltaPct = totalFirst > 0 ? ((totalLast - totalFirst) / totalFirst) * 100 : 0;

  return (
    <div className="border border-dotted rounded-md overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-dashed border-muted-foreground/20">
            <th className="text-left py-2 pl-3 pr-4 font-bold text-muted-foreground min-w-[160px] sticky left-0 bg-background">
              Depense
            </th>
            {sortedYears.map((y) => (
              <th key={y} className="text-right py-2 px-3 font-bold text-muted-foreground">
                {y}
              </th>
            ))}
            <th className="text-right py-2 px-3 font-bold text-muted-foreground">Evo.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ expense, values, deltaPct }) => (
            <tr key={expense.id} className="hover:bg-muted/20 transition-colors border-b border-dashed border-muted-foreground/10">
              <td className="py-1.5 pl-3 pr-4 sticky left-0 bg-background">
                <div className="font-medium truncate max-w-[160px]">{expense.label}</div>
                <div className="text-[9px] text-muted-foreground">
                  {EXPENSE_CATEGORY_LABELS[expense.categorie]}
                </div>
              </td>
              {values.map((v, idx) => {
                const prev = idx > 0 ? values[idx - 1] : v;
                const changed = idx > 0 && v !== prev;
                return (
                  <td
                    key={idx}
                    className={`py-1.5 px-3 text-right tabular-nums ${changed ? "font-semibold" : "text-muted-foreground"}`}
                  >
                    {formatCurrency(v)}
                  </td>
                );
              })}
              <td
                className={`py-1.5 px-3 text-right tabular-nums font-semibold ${
                  deltaPct > 0 ? "text-destructive" : deltaPct < 0 ? "text-green-600" : "text-muted-foreground"
                }`}
              >
                {deltaPct === 0 ? "—" : `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-dashed border-muted-foreground/20 bg-muted/30 font-bold">
            <td className="py-2 pl-3 pr-4 sticky left-0 bg-muted/30">Total annuel</td>
            {totals.map((t, idx) => (
              <td key={idx} className="py-2 px-3 text-right tabular-nums">
                {formatCurrency(t)}
              </td>
            ))}
            <td
              className={`py-2 px-3 text-right tabular-nums ${
                totalDeltaPct > 0 ? "text-destructive" : totalDeltaPct < 0 ? "text-green-600" : ""
              }`}
            >
              {totalDeltaPct === 0 ? "—" : `${totalDeltaPct > 0 ? "+" : ""}${totalDeltaPct.toFixed(1)}%`}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
