"use client";

import { useState } from "react";
import type { Income, IncomeCategory, IncomeFrequency } from "@/types";
import { INCOME_CATEGORY_LABELS, FREQUENCY_LABELS } from "@/types";
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

type IncomeFormData = Omit<Income, "id" | "createdAt" | "updatedAt">;

interface IncomeFormProps {
  propertyId: string;
  initialData?: Partial<IncomeFormData>;
  onSubmit: (data: IncomeFormData) => void;
  trigger?: React.ReactNode;
}

export function IncomeForm({ propertyId, initialData, onSubmit, trigger }: IncomeFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IncomeFormData>({
    propertyId,
    categorie: initialData?.categorie ?? "loyer",
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
      label: form.label || INCOME_CATEGORY_LABELS[form.categorie],
    });
    setOpen(false);
    setForm({
      propertyId,
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categorie</Label>
              <Select value={form.categorie} onValueChange={(v) => update("categorie", v as IncomeCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INCOME_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequence</Label>
              <Select value={form.frequence} onValueChange={(v) => update("frequence", v as IncomeFrequency)}>
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
              placeholder={INCOME_CATEGORY_LABELS[form.categorie]}
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
