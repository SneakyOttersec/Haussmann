"use client";

import { useState } from "react";
import type { Revenu, FrequenceRevenu } from "@/types";
import { CATEGORIE_REVENU_LABELS, FREQUENCY_LABELS } from "@/types";
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
  incomes: Revenu[];
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Revenu>) => void;
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
  value: FrequenceRevenu;
  onChange: (v: FrequenceRevenu) => void;
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
          onClick={() => { onChange(k as FrequenceRevenu); setOpen(false); }}
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

export function IncomeList({ incomes, onDelete, onUpdate }: IncomeListProps) {
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
            <TableCell className="font-medium">
              {onUpdate ? (
                <EditableCell
                  value={income.label}
                  onSave={(v) => onUpdate(income.id, { label: String(v) })}
                />
              ) : income.label}
            </TableCell>
            <TableCell className="text-muted-foreground">{CATEGORIE_REVENU_LABELS[income.categorie]}</TableCell>
            <TableCell className="text-right">
              {onUpdate ? (
                <EditableCell
                  value={income.montant}
                  type="number"
                  onSave={(v) => onUpdate(income.id, { montant: Number(v) })}
                  className="text-right"
                />
              ) : formatCurrency(income.montant)}
            </TableCell>
            <TableCell>
              {onUpdate ? (
                <FrequencyChips
                  value={income.frequence}
                  onChange={(v) => onUpdate(income.id, { frequence: v })}
                />
              ) : FREQUENCY_LABELS[income.frequence]}
            </TableCell>
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
