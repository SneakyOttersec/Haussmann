"use client";

import { useState } from "react";
import type { Depense, CategorieDepense, FrequenceDepense } from "@/types";
import { CATEGORIE_DEPENSE_LABELS, FREQUENCY_LABELS } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { expenseSchema, validateForm, type ValidationErrors } from "@/lib/validation";

type ExpenseFormData = Omit<Depense, "id" | "createdAt" | "updatedAt">;

interface ExpenseFormProps {
  propertyId: string;
  initialData?: Partial<ExpenseFormData>;
  onSubmit: (data: ExpenseFormData) => void;
  trigger?: React.ReactNode;
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(options).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k as T)}
          className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
            value === k
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {label as string}
        </button>
      ))}
    </div>
  );
}

export function ExpenseForm({ propertyId, initialData, onSubmit, trigger }: ExpenseFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormData>({
    propertyId,
    categorie: initialData?.categorie ?? "autre",
    label: initialData?.label ?? "",
    montant: initialData?.montant ?? 0,
    frequence: initialData?.frequence ?? "mensuel",
    dateDebut: initialData?.dateDebut ?? new Date().toISOString().slice(0, 10),
    dateFin: initialData?.dateFin,
    notes: initialData?.notes ?? "",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateForm(expenseSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit({
      ...form,
      label: form.label || CATEGORIE_DEPENSE_LABELS[form.categorie],
    });
    setOpen(false);
    setForm({
      propertyId,
      categorie: "autre",
      label: "",
      montant: 0,
      frequence: "mensuel",
      dateDebut: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  };

  const update = <K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? undefined : <Button variant="outline" size="sm" />}>
        {trigger ?? "+ Depense"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une depense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Categorie</Label>
            <ChipGroup
              options={CATEGORIE_DEPENSE_LABELS}
              value={form.categorie}
              onChange={(v) => update("categorie", v)}
            />
          </div>
          <div className="space-y-2.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Frequence</Label>
            <ChipGroup
              options={FREQUENCY_LABELS}
              value={form.frequence}
              onChange={(v) => update("frequence", v)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Label</Label>
            <Input
              value={form.label}
              onChange={(e) => update("label", e.target.value)}
              placeholder={CATEGORIE_DEPENSE_LABELS[form.categorie]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant (EUR)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.montant || ""}
                onChange={(e) => update("montant", Number(e.target.value))}
                required
              />
              {errors.montant && <p className="text-xs text-red-500">{errors.montant}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date debut</Label>
              <Input
                type="date"
                value={form.dateDebut}
                onChange={(e) => update("dateDebut", e.target.value)}
              />
              {errors.dateDebut && <p className="text-xs text-red-500">{errors.dateDebut}</p>}
            </div>
          </div>
          <Button type="submit" className="w-full mt-2">Ajouter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
