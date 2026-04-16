"use client";

import { useState } from "react";
import type { Pret, TypePret, TypeDiffere } from "@/types";
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

type LoanFormData = Omit<Pret, "id">;

interface LoanFormProps {
  propertyId: string;
  initialData?: LoanFormData;
  onSubmit: (data: LoanFormData) => void;
}

export function FormulairePret({ propertyId, initialData, onSubmit }: LoanFormProps) {
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
    differeInclus: initialData?.differeInclus ?? true,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  // Mode de saisie de l'assurance. Stocke toujours assuranceAnnuelle en interne,
  // mais laisse l'utilisateur entrer la valeur en mensuel / annuel / total.
  const [assuranceMode, setAssuranceMode] = useState<"mensuel" | "annuel" | "total">("annuel");
  // Duree totale (en annees, fractionnaire) utilisee pour convertir un total
  // en annuel. differeInclus = true → duree inchangee, sinon differeMois s'ajoute.
  const dureeTotaleAnnees =
    form.dureeAnnees + (form.differeInclus ? 0 : (form.differeMois ?? 0) / 12);
  // Valeur affichee dans l'input selon le mode courant.
  const assuranceDisplay = (() => {
    const a = form.assuranceAnnuelle;
    if (!a) return "";
    if (assuranceMode === "mensuel") return (a / 12).toFixed(2);
    if (assuranceMode === "total") return (a * dureeTotaleAnnees).toFixed(2);
    return String(a);
  })();
  const handleAssuranceChange = (raw: string) => {
    const v = Number(raw);
    if (isNaN(v)) return;
    if (assuranceMode === "mensuel") update("assuranceAnnuelle", v * 12);
    else if (assuranceMode === "total") update("assuranceAnnuelle", dureeTotaleAnnees > 0 ? v / dureeTotaleAnnees : 0);
    else update("assuranceAnnuelle", v);
  };

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
      <DialogContent className="max-w-2xl w-full">
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
              <Select value={form.type} onValueChange={(v) => update("type", v as TypePret)}>
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
              <Label>
                Assurance ({assuranceMode === "mensuel" ? "mensuelle" : assuranceMode === "total" ? "totale" : "annuelle"}, EUR)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={assuranceDisplay}
                  onChange={(e) => handleAssuranceChange(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={assuranceMode}
                  onValueChange={(v) => setAssuranceMode(v as typeof assuranceMode)}
                >
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensuel">Mensuel</SelectItem>
                    <SelectItem value="annuel">Annuel</SelectItem>
                    <SelectItem value="total">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assuranceMode !== "annuel" && form.assuranceAnnuelle > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Equivalent : {form.assuranceAnnuelle.toFixed(2)} EUR/an
                </p>
              )}
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
                  onValueChange={(v) => update("differeType", v as TypeDiffere)}
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
              <>
                <div className="flex gap-2">
                  {([
                    { value: true, label: "Inclus dans la duree", desc: `${form.dureeAnnees} ans dont ${form.differeMois}m de differe` },
                    { value: false, label: "En plus de la duree", desc: (() => {
                      const totalMois = form.dureeAnnees * 12 + (form.differeMois ?? 0);
                      const ans = Math.floor(totalMois / 12);
                      const mois = totalMois % 12;
                      return `${form.differeMois}m + ${form.dureeAnnees} ans = ${ans} ans${mois > 0 ? ` ${mois}m` : ""}`;
                    })() },
                  ] as const).map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => update("differeInclus", opt.value)}
                      className={`flex-1 px-3 py-2 rounded-md text-xs text-left transition-colors border ${
                        form.differeInclus === opt.value
                          ? "border-primary/40 bg-primary/10 text-primary font-medium"
                          : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="block font-medium">{opt.label}</span>
                      <span className="block text-[10px] mt-0.5 opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                  {form.differeType === "total"
                    ? `Pendant ${form.differeMois} mois, aucun paiement. Les interets sont capitalises (ajoutes au capital). L'amortissement commence ensuite sur le capital majore.`
                    : `Pendant ${form.differeMois} mois, seuls les interets sont payes. Le capital reste intact, l'amortissement commence ensuite.`}
                </p>
              </>
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
