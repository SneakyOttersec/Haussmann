"use client";

import { useState } from "react";
import type { Expense, ExpenseCategory, ExpenseFrequency } from "@/types";
import { EXPENSE_CATEGORY_LABELS, FREQUENCY_LABELS } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ExpenseFormData = Omit<Expense, "id" | "createdAt" | "updatedAt">;

interface ExpenseFormProps {
  propertyId: string;
  initialData?: Partial<ExpenseFormData>;
  onSubmit: (data: ExpenseFormData) => void;
  trigger?: React.ReactNode;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      label: form.label || EXPENSE_CATEGORY_LABELS[form.categorie],
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categorie</Label>
              <Select value={form.categorie} onValueChange={(v) => update("categorie", v as ExpenseCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequence</Label>
              <Select value={form.frequence} onValueChange={(v) => update("frequence", v as ExpenseFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={form.label}
              onChange={(e) => update("label", e.target.value)}
              placeholder={EXPENSE_CATEGORY_LABELS[form.categorie]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Montant (EUR)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.montant || ""}
                onChange={(e) => update("montant", Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date debut</Label>
              <Input
                type="date"
                value={form.dateDebut}
                onChange={(e) => update("dateDebut", e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full">Ajouter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
