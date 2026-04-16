"use client";

import { useState } from "react";
import type { Bien, TypeBien, Pret, TypePret, TypeDiffere, ModeAssurancePret } from "@/types";
import { TYPE_BIEN_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { calculerMensualiteAmortissable } from "@/lib/calculations/loan";
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
import { propertySchema, validateForm, type ValidationErrors } from "@/lib/validation";

type PropertyFormData = Omit<Bien, "id" | "createdAt" | "updatedAt">;
export type LoanFormData = Omit<Pret, "id">;

interface PropertyFormProps {
  initialData?: Partial<PropertyFormData>;
  onSubmit: (data: PropertyFormData, loanData?: LoanFormData) => void;
  submitLabel?: string;
  /** Show the Financement section (for new property creation). */
  showFinancement?: boolean;
}

export function PropertyForm({ initialData, onSubmit, submitLabel = "Creer le bien", showFinancement }: PropertyFormProps) {
  const [form, setForm] = useState<PropertyFormData>({
    nom: initialData?.nom ?? "",
    adresse: initialData?.adresse ?? "",
    type: initialData?.type ?? "appartement",
    prixAchat: initialData?.prixAchat ?? 0,
    dateSaisie: initialData?.dateSaisie ?? new Date().toISOString().slice(0, 10),
    fraisNotaire: initialData?.fraisNotaire ?? 0,
    fraisAgence: initialData?.fraisAgence ?? 0,
    fraisDossier: initialData?.fraisDossier ?? 0,
    fraisCourtage: initialData?.fraisCourtage ?? 0,
    montantTravaux: initialData?.montantTravaux ?? 0,
    montantMobilier: initialData?.montantMobilier ?? 0,
    surfaceM2: initialData?.surfaceM2,
    notes: initialData?.notes ?? "",
    ville: initialData?.ville ?? "",
    anneeConstruction: initialData?.anneeConstruction,
    dpe: initialData?.dpe,
  });

  // Optional loan state — only when showFinancement
  const [withLoan, setWithLoan] = useState(false);
  const [loan, setLoan] = useState({
    apport: 0,
    montantEmprunte: 0,
    type: "amortissable" as TypePret,
    tauxAnnuel: 0.035,
    dureeAnnees: 20,
    assuranceMode: "eur" as ModeAssurancePret,
    assuranceAnnuelle: 0,
    assurancePct: 0.0034,
    differeMois: 0,
    differeType: "partiel" as TypeDiffere,
    differeInclus: true,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const coutTotal = form.prixAchat + form.fraisNotaire + form.fraisAgence
    + form.fraisDossier + form.fraisCourtage + form.montantTravaux + form.montantMobilier;

  const handleApportChange = (v: number) => {
    setLoan((prev) => ({ ...prev, apport: v, montantEmprunte: Math.max(0, Math.round(coutTotal - v)) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateForm(propertySchema, form);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    if (showFinancement && withLoan && loan.montantEmprunte > 0) {
      const assurance = loan.assuranceMode === "pct"
        ? loan.montantEmprunte * loan.assurancePct
        : loan.assuranceAnnuelle;
      onSubmit(
        { ...form, apport: loan.apport || undefined },
        {
          propertyId: "", // will be replaced by caller
          type: loan.type,
          montantEmprunte: loan.montantEmprunte,
          tauxAnnuel: loan.tauxAnnuel,
          dureeAnnees: loan.dureeAnnees,
          dateDebut: form.dateSaisie || new Date().toISOString().slice(0, 10),
          assuranceAnnuelle: assurance,
          differeMois: loan.differeMois || undefined,
          differeType: loan.differeMois ? loan.differeType : undefined,
          differeInclus: loan.differeMois ? loan.differeInclus : undefined,
        },
      );
    } else {
      onSubmit(form);
    }
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
          {errors.nom && <p className="text-xs text-red-500">{errors.nom}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={form.type} onValueChange={(v) => update("type", v as TypeBien)}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_BIEN_LABELS).map(([value, label]) => (
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
        {errors.adresse && <p className="text-xs text-red-500">{errors.adresse}</p>}
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
          {errors.prixAchat && <p className="text-xs text-red-500">{errors.prixAchat}</p>}
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
          <Label htmlFor="fraisAgence">Frais d&apos;agence (EUR)</Label>
          <Input
            id="fraisAgence"
            type="number"
            min={0}
            value={form.fraisAgence || ""}
            onChange={(e) => update("fraisAgence", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div className="space-y-2">
          <Label htmlFor="montantMobilier">Mobilier (EUR)</Label>
          <Input
            id="montantMobilier"
            type="number"
            min={0}
            value={form.montantMobilier || ""}
            onChange={(e) => update("montantMobilier", Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fraisDossier">Frais de dossier (EUR)</Label>
          <Input
            id="fraisDossier"
            type="number"
            min={0}
            value={form.fraisDossier || ""}
            onChange={(e) => update("fraisDossier", Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fraisCourtage">Frais de courtage (EUR)</Label>
          <Input
            id="fraisCourtage"
            type="number"
            min={0}
            value={form.fraisCourtage || ""}
            onChange={(e) => update("fraisCourtage", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateSaisie">Date d&apos;achat</Label>
          <Input
            id="dateSaisie"
            type="date"
            value={form.dateSaisie}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => update("dateSaisie", e.target.value)}
          />
          {errors.dateSaisie && <p className="text-xs text-red-500">{errors.dateSaisie}</p>}
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

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ville">Ville</Label>
          <Input
            id="ville"
            value={form.ville ?? ""}
            onChange={(e) => update("ville", e.target.value)}
            placeholder="ex: Thiers (63)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="anneeConstruction">Annee de construction</Label>
          <Input
            id="anneeConstruction"
            type="number"
            min={1700}
            max={new Date().getFullYear()}
            value={form.anneeConstruction ?? ""}
            onChange={(e) => update("anneeConstruction", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="ex: 1920"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dpe">DPE</Label>
          <select
            id="dpe"
            value={form.dpe ?? ""}
            onChange={(e) => update("dpe", (e.target.value || undefined) as typeof form.dpe)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">—</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
            <option value="F">F</option>
            <option value="G">G</option>
            <option value="VIERGE">Vierge / non realise</option>
          </select>
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

      {/* Financement (opt-in, new property only) */}
      {showFinancement && form.prixAchat > 0 && (
        <div className="border border-dotted rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider">Financement</h2>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={withLoan}
                onChange={(e) => {
                  setWithLoan(e.target.checked);
                  if (e.target.checked && loan.montantEmprunte === 0) {
                    setLoan((prev) => ({ ...prev, montantEmprunte: Math.round(coutTotal) }));
                  }
                }}
                className="accent-primary"
              />
              <span className={withLoan ? "text-foreground font-medium" : "text-muted-foreground"}>
                Ajouter un credit
              </span>
            </label>
          </div>

          {withLoan && (
            <>
              <div className="flex items-end justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Cout total du projet : <span className="font-bold text-foreground">{formatCurrency(coutTotal)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setLoan((prev) => ({ ...prev, montantEmprunte: Math.max(0, Math.round(coutTotal - prev.apport)) }))}
                  className="text-[10px] text-primary hover:underline"
                >
                  Recalculer emprunt
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Apport personnel (EUR)</Label>
                  <Input type="number" min={0} value={loan.apport || ""} onChange={(e) => handleApportChange(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Montant emprunte (EUR)</Label>
                  <Input type="number" min={0} value={loan.montantEmprunte || ""} onChange={(e) => setLoan((prev) => ({ ...prev, montantEmprunte: Number(e.target.value) }))} />
                </div>
              </div>

              {(() => {
                const totalFinance = loan.montantEmprunte + loan.apport;
                const ecart = totalFinance - coutTotal;
                if (Math.abs(ecart) > 1) {
                  return (
                    <p className="text-[10px] text-amber-600">
                      Apport + emprunt = {formatCurrency(totalFinance)} ({ecart > 0 ? `+${formatCurrency(ecart)} excedent` : `${formatCurrency(Math.abs(ecart))} manquants`} vs cout du projet).
                    </p>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de pret</Label>
                  <Select value={loan.type} onValueChange={(v) => setLoan((prev) => ({ ...prev, type: v as TypePret }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amortissable">Amortissable</SelectItem>
                      <SelectItem value="in_fine">In fine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Taux nominal (%)</Label>
                  <Input type="number" min={0} step="0.01" value={loan.tauxAnnuel ? (loan.tauxAnnuel * 100).toFixed(2) : ""} onChange={(e) => setLoan((prev) => ({ ...prev, tauxAnnuel: Number(e.target.value) / 100 }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duree (annees)</Label>
                  <Input type="number" min={1} max={30} value={loan.dureeAnnees || ""} onChange={(e) => setLoan((prev) => ({ ...prev, dureeAnnees: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Differe (mois)</Label>
                  <Input type="number" min={0} max={60} value={loan.differeMois || ""} onChange={(e) => setLoan((prev) => ({ ...prev, differeMois: Number(e.target.value) || 0 }))} />
                </div>
              </div>

              {loan.differeMois > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type de differe</Label>
                    <Select value={loan.differeType} onValueChange={(v) => setLoan((prev) => ({ ...prev, differeType: v as TypeDiffere }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="min-w-[260px]">
                        <SelectItem value="partiel">Partiel (interets seulement)</SelectItem>
                        <SelectItem value="total">Total (capitalisation)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Differe</Label>
                    <Select value={loan.differeInclus ? "inclus" : "en_plus"} onValueChange={(v) => setLoan((prev) => ({ ...prev, differeInclus: v === "inclus" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="min-w-[260px]">
                        <SelectItem value="inclus">Inclus dans la duree</SelectItem>
                        <SelectItem value="en_plus">En plus de la duree</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Assurance pret</Label>
                  <Select value={loan.assuranceMode} onValueChange={(v) => setLoan((prev) => ({ ...prev, assuranceMode: v as ModeAssurancePret }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eur">EUR/an</SelectItem>
                      <SelectItem value="pct">% du capital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {loan.assuranceMode === "eur" ? (
                  <div className="space-y-2">
                    <Label>Assurance (EUR/an)</Label>
                    <Input type="number" min={0} value={loan.assuranceAnnuelle || ""} onChange={(e) => setLoan((prev) => ({ ...prev, assuranceAnnuelle: Number(e.target.value) }))} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Taux assurance (%)</Label>
                    <Input type="number" min={0} step="0.01" value={loan.assurancePct ? (loan.assurancePct * 100).toFixed(2) : ""} onChange={(e) => setLoan((prev) => ({ ...prev, assurancePct: Number(e.target.value) / 100 }))} />
                  </div>
                )}
              </div>

              {/* Recap mensualite */}
              {loan.montantEmprunte > 0 && loan.dureeAnnees > 0 && (() => {
                const assAn = loan.assuranceMode === "pct" ? loan.montantEmprunte * loan.assurancePct : loan.assuranceAnnuelle;
                const dM = loan.differeMois;
                const dureeAmortMois = loan.differeInclus
                  ? loan.dureeAnnees * 12 - dM
                  : loan.dureeAnnees * 12;
                const t = loan.tauxAnnuel / 12;
                const mens = dureeAmortMois > 0 && t > 0
                  ? calculerMensualiteAmortissable(loan.montantEmprunte, loan.tauxAnnuel, dureeAmortMois / 12)
                  : loan.montantEmprunte / Math.max(1, dureeAmortMois);
                const mensTotale = mens + assAn / 12;
                const intDiffere = loan.montantEmprunte * t;
                return (
                  <div className="border-t border-dashed border-muted-foreground/15 pt-3 text-sm space-y-1">
                    {dM > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Mensualite pendant differe ({dM}m)</span>
                        <span className="tabular-nums font-medium text-foreground">
                          {formatCurrency(loan.differeType === "total" ? assAn / 12 : intDiffere + assAn / 12, true)}/m
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold">
                      <span>{dM > 0 ? "Mensualite post-differe" : "Mensualite"}</span>
                      <span className="tabular-nums">{formatCurrency(mensTotale, true)}/m</span>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Recap cout total */}
      {form.prixAchat > 0 && (() => {
          + form.fraisDossier + form.fraisCourtage + form.montantTravaux + form.montantMobilier;
        const lines = [
          { label: "Prix d'achat", value: form.prixAchat },
          { label: "Frais de notaire", value: form.fraisNotaire },
          { label: "Frais d'agence", value: form.fraisAgence },
          { label: "Frais dossier + courtage", value: form.fraisDossier + form.fraisCourtage },
          { label: "Travaux", value: form.montantTravaux },
          { label: "Mobilier", value: form.montantMobilier },
        ].filter((l) => l.value > 0);

        return (
          <div className="border border-dashed border-muted-foreground/20 rounded-md px-4 py-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Recap cout total</p>
            {lines.map((l) => (
              <div key={l.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{l.label}</span>
                <span className="tabular-nums">{formatCurrency(l.value)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-dashed border-muted-foreground/15">
              <span>Cout total</span>
              <span className="tabular-nums">{formatCurrency(coutTotal)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              L&apos;apport personnel sera calcule automatiquement une fois le credit defini :
              apport = cout total - montant emprunte.
            </p>
          </div>
        );
      })()}

      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );
}
