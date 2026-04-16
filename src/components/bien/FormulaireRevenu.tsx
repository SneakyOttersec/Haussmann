"use client";

import { useState } from "react";
import type { Revenu, CategorieRevenu, FrequenceRevenu } from "@/types";
import { CATEGORIE_REVENU_LABELS, FREQUENCY_LABELS } from "@/types";
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
import { incomeSchema, validateForm, type ValidationErrors } from "@/lib/validation";

type IncomeFormData = Omit<Revenu, "id" | "createdAt" | "updatedAt">;

interface IncomeFormProps {
  bienId: string;
  initialData?: Partial<IncomeFormData>;
  onSubmit: (data: IncomeFormData) => void;
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

export function FormulaireRevenu({ bienId, initialData, onSubmit, trigger }: IncomeFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IncomeFormData>({
    bienId,
    categorie: initialData?.categorie ?? "loyer",
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
    const result = validateForm(incomeSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit({
      ...form,
      label: form.label || CATEGORIE_REVENU_LABELS[form.categorie],
    });
    setOpen(false);
    setForm({
      bienId,
      categorie: "loyer",
      label: "",
      montant: 0,
      frequence: "mensuel",
      dateDebut: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  };

  const update = <K extends keyof IncomeFormData>(key: K, value: IncomeFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? undefined : <Button variant="outline" size="sm" />}>
        {trigger ?? "+ Revenu"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un revenu</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Categorie</Label>
            <ChipGroup
              options={CATEGORIE_REVENU_LABELS}
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
              placeholder={CATEGORIE_REVENU_LABELS[form.categorie]}
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
