"use client";

import { useState } from "react";
import type { Expense, ExpenseFrequency } from "@/types";
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
  onUpdate?: (id: string, updates: Partial<Expense>) => void;
}

function EditableCell({
  value,
  type = "text",
  onSave,
  className,
}: {
  value: string | number;
  type?: "text" | "number";
  onSave: (v: string | number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors ${className ?? ""}`}
        onClick={() => { setDraft(String(value)); setEditing(true); }}
      >
        {type === "number" ? formatCurrency(Number(value)) : value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = type === "number" ? Number(draft) || 0 : draft;
        if (v !== value) onSave(v);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-full h-6 px-1 text-sm border border-input rounded bg-transparent outline-none focus:border-ring"
      step={type === "number" ? "0.01" : undefined}
    />
  );
}

function FrequencyChips({
  value,
  onChange,
}: {
  value: ExpenseFrequency;
  onChange: (v: ExpenseFrequency) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <span
        className="cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors"
        onClick={() => setOpen(true)}
      >
        {FREQUENCY_LABELS[value]}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(FREQUENCY_LABELS).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => { onChange(k as ExpenseFrequency); setOpen(false); }}
          className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
            value === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  credit: "🏦",
  taxe_fonciere: "��",
  assurance_pno: "🛡",
  gestion_locative: "🔑",
  copropriete: "🏢",
  reparations: "🔧",
  charges_locatives: "💡",
  vacance: "🚪",
  frais_notaire: "⚖",
  travaux: "🏗",
  ameublement: "🪑",
  autre: "📌",
};

export function ExpenseList({ expenses, onDelete, onUpdate }: ExpenseListProps) {
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
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs">{CATEGORY_ICONS[expense.categorie] ?? "📌"}</span>
                        {onUpdate ? (
                          <EditableCell
                            value={expense.label}
                            onSave={(v) => onUpdate(expense.id, { label: String(v) })}
                          />
                        ) : expense.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[expense.categorie]}</TableCell>
                    <TableCell className="text-right">
                      {onUpdate ? (
                        <EditableCell
                          value={expense.montant}
                          type="number"
                          onSave={(v) => onUpdate(expense.id, { montant: Number(v) })}
                          className="text-right"
                        />
                      ) : formatCurrency(expense.montant)}
                    </TableCell>
                    <TableCell>
                      {onUpdate ? (
                        <FrequencyChips
                          value={expense.frequence}
                          onChange={(v) => onUpdate(expense.id, { frequence: v })}
                        />
                      ) : FREQUENCY_LABELS[expense.frequence]}
                    </TableCell>
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
