"use client";

import { useState } from "react";
import type { Property, PropertyType } from "@/types";
import { PROPERTY_TYPE_LABELS } from "@/types";
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

type PropertyFormData = Omit<Property, "id" | "createdAt" | "updatedAt">;

interface PropertyFormProps {
  initialData?: Partial<PropertyFormData>;
  onSubmit: (data: PropertyFormData) => void;
  submitLabel?: string;
}

export function PropertyForm({ initialData, onSubmit, submitLabel = "Creer le bien" }: PropertyFormProps) {
  const [form, setForm] = useState<PropertyFormData>({
    nom: initialData?.nom ?? "",
    adresse: initialData?.adresse ?? "",
    type: initialData?.type ?? "appartement",
    prixAchat: initialData?.prixAchat ?? 0,
    dateAchat: initialData?.dateAchat ?? new Date().toISOString().slice(0, 10),
    fraisNotaire: initialData?.fraisNotaire ?? 0,
    montantTravaux: initialData?.montantTravaux ?? 0,
    surfaceM2: initialData?.surfaceM2,
    notes: initialData?.notes ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const update = <K extends keyof PropertyFormData>(key: K, value: PropertyFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nom">Nom du bien</Label>
          <Input
            id="nom"
            value={form.nom}
            onChange={(e) => update("nom", e.target.value)}
            placeholder="Appartement Bordeaux T3"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={form.type} onValueChange={(v) => update("type", v as PropertyType)}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adresse">Adresse</Label>
        <Input
          id="adresse"
          value={form.adresse}
          onChange={(e) => update("adresse", e.target.value)}
          placeholder="12 rue de la Paix, 75001 Paris"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="prixAchat">Prix d&apos;achat (EUR)</Label>
          <Input
            id="prixAchat"
            type="number"
            min={0}
            value={form.prixAchat || ""}
            onChange={(e) => update("prixAchat", Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fraisNotaire">Frais de notaire (EUR)</Label>
          <Input
            id="fraisNotaire"
            type="number"
            min={0}
            value={form.fraisNotaire || ""}
            onChange={(e) => update("fraisNotaire", Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="montantTravaux">Travaux (EUR)</Label>
          <Input
            id="montantTravaux"
            type="number"
            min={0}
            value={form.montantTravaux || ""}
            onChange={(e) => update("montantTravaux", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateAchat">Date d&apos;achat</Label>
          <Input
            id="dateAchat"
            type="date"
            value={form.dateAchat}
            onChange={(e) => update("dateAchat", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="surfaceM2">Surface (m²)</Label>
          <Input
            id="surfaceM2"
            type="number"
            min={0}
            value={form.surfaceM2 ?? ""}
            onChange={(e) => update("surfaceM2", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Notes supplementaires..."
        />
      </div>

      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );
}
