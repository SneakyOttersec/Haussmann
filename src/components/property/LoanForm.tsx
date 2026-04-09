"use client";

import { useState } from "react";
import type { LoanDetails, LoanType, DifferType } from "@/types";
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
import { loanSchema, validateForm, type ValidationErrors } from "@/lib/validation";

type LoanFormData = Omit<LoanDetails, "id">;

interface LoanFormProps {
  propertyId: string;
  initialData?: LoanFormData;
  onSubmit: (data: LoanFormData) => void;
}

export function LoanForm({ propertyId, initialData, onSubmit }: LoanFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LoanFormData>({
    propertyId,
    type: initialData?.type ?? "amortissable",
    montantEmprunte: initialData?.montantEmprunte ?? 0,
    tauxAnnuel: initialData?.tauxAnnuel ?? 0.035,
    dureeAnnees: initialData?.dureeAnnees ?? 20,
    dateDebut: initialData?.dateDebut ?? new Date().toISOString().slice(0, 10),
    assuranceAnnuelle: initialData?.assuranceAnnuelle ?? 0,
    differeMois: initialData?.differeMois ?? 0,
    differeType: initialData?.differeType ?? "partiel",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateForm(loanSchema, form);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(form);
    setOpen(false);
  };

  const update = <K extends keyof LoanFormData>(key: K, value: LoanFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {initialData ? "Modifier" : "+ Credit"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? "Modifier le credit" : "Ajouter un credit"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Montant emprunte (EUR)</Label>
              <Input
                type="number"
                min={0}
                value={form.montantEmprunte || ""}
                onChange={(e) => update("montantEmprunte", Number(e.target.value))}
                required
              />
              {errors.montantEmprunte && <p className="text-xs text-red-500">{errors.montantEmprunte}</p>}
            </div>
            <div className="space-y-2">
              <Label>Type de pret</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v as LoanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amortissable">Amortissable</SelectItem>
                  <SelectItem value="in_fine">In fine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Taux annuel (%)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.tauxAnnuel ? (form.tauxAnnuel * 100).toFixed(2) : ""}
                onChange={(e) => update("tauxAnnuel", Number(e.target.value) / 100)}
                required
              />
              {errors.tauxAnnuel && <p className="text-xs text-red-500">{errors.tauxAnnuel}</p>}
            </div>
            <div className="space-y-2">
              <Label>Duree (annees)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={form.dureeAnnees || ""}
                onChange={(e) => update("dureeAnnees", Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date debut</Label>
              <Input
                type="date"
                value={form.dateDebut}
                onChange={(e) => update("dateDebut", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Assurance annuelle (EUR)</Label>
              <Input
                type="number"
                min={0}
                value={form.assuranceAnnuelle || ""}
                onChange={(e) => update("assuranceAnnuelle", Number(e.target.value))}
              />
            </div>
          </div>

          {/* Differe */}
          <div className="border-t border-dashed border-muted-foreground/15 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Differe (optionnel)</Label>
              <p className="text-[10px] text-muted-foreground">Inclus dans la duree totale</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duree du differe (mois)</Label>
                <Input
                  type="number"
                  min={0}
                  max={form.dureeAnnees * 12 - 1}
                  value={form.differeMois ?? 0}
                  onChange={(e) => update("differeMois", Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type de differe</Label>
                <Select
                  value={form.differeType ?? "partiel"}
                  onValueChange={(v) => update("differeType", v as DifferType)}
                  disabled={!form.differeMois || form.differeMois <= 0}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partiel">Partiel (interets seulement)</SelectItem>
                    <SelectItem value="total">Total (capitalisation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(form.differeMois ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                {form.differeType === "total"
                  ? `Pendant ${form.differeMois} mois, aucun paiement. Les interets sont capitalises (ajoutes au capital). L'amortissement commence ensuite sur le capital majore.`
                  : `Pendant ${form.differeMois} mois, seuls les interets sont payes. Le capital reste intact, l'amortissement commence ensuite sur la duree restante.`}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full">
            {initialData ? "Modifier" : "Ajouter"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
