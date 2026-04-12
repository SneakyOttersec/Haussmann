"use client";

import type { CalculatorInputs, TaxRegime, LoanType, AssurancePretMode, LotLoyer, LotMobilier, LotTravaux } from "@/types";
import { TRAVAUX_CATEGORIES, AMORT_DUREES } from "@/types";
import { TMI_TRANCHES } from "@/lib/constants";
import { checkFileSize } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useRef, useState } from "react";

export interface CalculatorFormProps {
  inputs: CalculatorInputs;
  onUpdate: <K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) => void;
}

const inputClass = "flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function NumField({ label, value, onChange, suffix, step, min }: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; step?: string; min?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}{suffix ? ` (${suffix})` : ""}</Label>
      <input
        type="number"
        min={min ?? 0}
        step={step ?? "1"}
        value={value === 0 ? "0" : value || ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={inputClass}
      />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleEurPct({ label, pctValue, eurValue, onChangePct, onChangeEur, suffix }: {
  label: string;
  pctValue: number;
  eurValue: number;
  onChangePct: (v: number) => void;
  onChangeEur: (v: number) => void;
  suffix?: string;
}) {
  const [mode, setMode] = useState<"pct" | "eur">("pct");
  const sfx = suffix ? `EUR/${suffix}` : "EUR";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <button
          type="button"
          onClick={() => setMode(mode === "pct" ? "eur" : "pct")}
          className="text-[9px] text-primary hover:underline"
        >
          {mode === "pct" ? `→ ${sfx}` : "→ %"}
        </button>
      </div>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
          {mode === "pct" ? "%" : "€"}
        </span>
        {mode === "pct" ? (
          <input
            type="number"
            min={0}
            step="0.01"
            value={Math.round(pctValue * 10000) / 100 === 0 ? "0" : Math.round(pctValue * 10000) / 100 || ""}
            onChange={(e) => onChangePct((e.target.value === "" ? 0 : Number(e.target.value)) / 100)}
            className={`${inputClass} pl-7`}
          />
        ) : (
          <input
            type="number"
            min={0}
            value={eurValue === 0 ? "0" : eurValue || ""}
            onChange={(e) => onChangeEur(e.target.value === "" ? 0 : Number(e.target.value))}
            className={`${inputClass} pl-7`}
          />
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 pt-2 pb-1">{children}</p>
  );
}

/* ── Simulation: full width, name+address left, map right ── */

function PhotoUpload({ photo, onChange }: { photo: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!checkFileSize(file)) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (photo) {
    return (
      <div className="relative group">
        <img src={photo} alt="Photo du bien" className="w-full h-36 object-cover rounded-md border border-dotted" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="text-[10px] text-white bg-white/20 hover:bg-white/30 rounded px-2 py-1">
            Changer
          </button>
          <button type="button" onClick={() => onChange("")} className="text-[10px] text-white bg-white/20 hover:bg-red-500/50 rounded px-2 py-1">
            Supprimer
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="h-36 border-2 border-dashed border-muted-foreground/20 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 transition-colors"
    >
      <span className="text-xs text-muted-foreground">Photo du bien</span>
      <span className="text-[10px] text-muted-foreground/60 mt-1">Cliquer pour ajouter (max 5 Mo)</span>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}

export function SimulationCard({ inputs, onUpdate }: CalculatorFormProps) {
  const mapsLink = inputs.adresse
    ? `https://www.google.com/maps/search/${encodeURIComponent(inputs.adresse)}`
    : null;

  return (
    <div className="border border-dotted rounded-lg p-5 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider">Simulation</h2>
      <TextField label="Nom" value={inputs.nomSimulation} onChange={(v) => onUpdate("nomSimulation", v)} placeholder="Ex: Appartement Lyon T3" />
      <TextField label="Adresse du bien" value={inputs.adresse} onChange={(v) => onUpdate("adresse", v)} placeholder="12 rue de la Paix, 75001 Paris" />

      <div className="grid gap-3 md:grid-cols-2">
        <PhotoUpload photo={inputs.photo ?? ""} onChange={(v) => onUpdate("photo", v)} />
        <div className="space-y-1.5">
          {inputs.adresse ? (
            <>
              <iframe
                title="Localisation du bien"
                width="100%"
                height="136"
                className="rounded-md border border-dotted"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(inputs.adresse)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a href={mapsLink!} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">
                Ouvrir dans Google Maps →
              </a>
            </>
          ) : (
            <div className="h-36 border-2 border-dashed border-muted-foreground/20 rounded-md flex items-center justify-center">
              <span className="text-xs text-muted-foreground/50">Entrez une adresse pour afficher la carte</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Lots editor ── */

function LotsEditor({ lots, onChange }: { lots: LotLoyer[]; onChange: (lots: LotLoyer[]) => void }) {
  const total = lots.reduce((sum, l) => sum + (l.loyerMensuel || 0), 0);

  const updateLot = (id: string, field: keyof LotLoyer, value: string | number) => {
    onChange(lots.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const addLot = () => {
    onChange([...lots, { id: crypto.randomUUID(), nom: `Lot ${lots.length + 1}`, loyerMensuel: 0 }]);
  };

  const removeLot = (id: string) => {
    if (lots.length <= 1) return;
    onChange(lots.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-1.5">
      {lots.map((lot) => (
        <div key={lot.id} className="flex items-end gap-2">
          <div className="flex-1 space-y-0.5">
            <input
              type="text"
              value={lot.nom}
              onChange={(e) => updateLot(lot.id, "nom", e.target.value)}
              placeholder="Nom du lot"
              className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <div className="w-24 space-y-0.5">
            <input
              type="number"
              min={0}
              value={lot.loyerMensuel || ""}
              onChange={(e) => updateLot(lot.id, "loyerMensuel", Number(e.target.value))}
              placeholder="EUR/m"
              className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs text-right outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <button
            type="button"
            onClick={() => { if (lots.length > 1) removeLot(lot.id); }}
            className={`h-7 px-1.5 text-xs rounded-md transition-colors ${lots.length <= 1 ? "text-muted-foreground/30 cursor-not-allowed" : "text-destructive hover:bg-destructive/10"}`}
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addLot}
          className="text-[11px] text-primary hover:underline"
        >
          + Ajouter un lot
        </button>
        <span className="text-[11px] text-muted-foreground">
          Total : <span className="font-bold text-foreground">{total.toLocaleString("fr-FR")} EUR/m</span>
        </span>
      </div>
    </div>
  );
}

/* ── Mobilier editor ── */

function MobilierEditor({ lots, onChange }: { lots: LotMobilier[]; onChange: (lots: LotMobilier[]) => void }) {
  const total = lots.reduce((sum, l) => sum + (l.montant || 0), 0);

  const updateLot = (id: string, field: keyof LotMobilier, value: string | number) => {
    onChange(lots.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const addLot = () => {
    onChange([...lots, { id: crypto.randomUUID(), nom: `Mobilier lot ${lots.length + 1}`, montant: 0 }]);
  };

  const removeLot = (id: string) => {
    onChange(lots.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-1.5">
      {lots.map((lot) => (
        <div key={lot.id} className="flex items-end gap-2">
          <div className="flex-1 space-y-0.5">
            <input
              type="text"
              value={lot.nom}
              onChange={(e) => updateLot(lot.id, "nom", e.target.value)}
              placeholder="Description"
              className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <div className="w-24 space-y-0.5">
            <input
              type="number"
              min={0}
              value={lot.montant || ""}
              onChange={(e) => updateLot(lot.id, "montant", Number(e.target.value))}
              placeholder="EUR"
              className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs text-right outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <button
            type="button"
            onClick={() => removeLot(lot.id)}
            className="h-7 px-1.5 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={addLot} className="text-[11px] text-primary hover:underline">
          + Ajouter du mobilier
        </button>
        {lots.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            Total : <span className="font-bold text-foreground">{total.toLocaleString("fr-FR")} EUR</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Travaux editor ── */

function TravauxEditor({ lots, onChange }: { lots: LotTravaux[]; onChange: (lots: LotTravaux[]) => void }) {
  const total = lots.reduce((sum, l) => sum + (l.montant || 0), 0);

  const updateLot = (id: string, field: keyof LotTravaux, value: string | number) => {
    onChange(lots.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const addLot = (cat?: typeof TRAVAUX_CATEGORIES[number]) => {
    onChange([...lots, {
      id: crypto.randomUUID(),
      nom: cat?.label ?? `Travaux ${lots.length + 1}`,
      montant: 0,
      dureeAmortissement: cat?.duree ?? 18,
    }]);
  };

  const removeLot = (id: string) => {
    onChange(lots.filter((l) => l.id !== id));
  };

  const smallInput = "flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <div className="space-y-1.5">
      {lots.map((lot) => (
        <div key={lot.id} className="flex items-end gap-1.5">
          <div className="flex-1">
            <input type="text" value={lot.nom} onChange={(e) => updateLot(lot.id, "nom", e.target.value)} placeholder="Type de travaux" className={smallInput} />
          </div>
          <div className="w-20">
            <input type="number" min={0} value={lot.montant === 0 ? "0" : lot.montant || ""} onChange={(e) => updateLot(lot.id, "montant", Number(e.target.value))} placeholder="EUR" className={`${smallInput} text-right`} />
          </div>
          <div className="w-14">
            <input type="number" min={1} max={50} value={lot.dureeAmortissement} onChange={(e) => updateLot(lot.id, "dureeAmortissement", Number(e.target.value))} className={`${smallInput} text-right`} />
          </div>
          <span className="text-[10px] text-muted-foreground w-6 shrink-0 pb-1">ans</span>
          <button type="button" onClick={() => removeLot(lot.id)} className="h-7 px-1 text-xs text-destructive hover:bg-destructive/10 rounded-md">×</button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1 flex-wrap gap-1">
        <div className="flex gap-1 flex-wrap">
          <button type="button" onClick={() => addLot()} className="text-[11px] text-primary hover:underline">+ Ajouter</button>
          {[TRAVAUX_CATEGORIES[0], TRAVAUX_CATEGORIES[1]].map((cat) => (
            <button key={cat.value} type="button" onClick={() => addLot(cat)} className="text-[10px] text-muted-foreground hover:text-primary border border-dashed rounded px-1.5 py-0.5">
              {cat.label}
            </button>
          ))}
        </div>
        {lots.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            Total : <span className="font-bold text-foreground">{total.toLocaleString("fr-FR")} EUR</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Left column: Bien + Revenus + Charges ── */

export function BienCard({ inputs, onUpdate }: CalculatorFormProps) {
  return (
    <div className="border border-dotted rounded-lg p-5 space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider">Bien & Revenus</h2>

      <SectionLabel>Acquisition</SectionLabel>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumField label="Prix d'achat" suffix="EUR" value={inputs.prixAchat} onChange={(v) => onUpdate("prixAchat", v)} />
        <ToggleEurPct
          label="Frais de notaire"
          pctValue={inputs.fraisNotairePct}
          eurValue={Math.round(inputs.prixAchat * inputs.fraisNotairePct)}
          onChangePct={(v) => onUpdate("fraisNotairePct", v)}
          onChangeEur={(v) => onUpdate("fraisNotairePct", inputs.prixAchat > 0 ? v / inputs.prixAchat : 0)}
        />
        <NumField label="Frais d'agence" suffix="EUR" value={inputs.fraisAgence} onChange={(v) => onUpdate("fraisAgence", v)} />
        <NumField label="Surface" suffix="m2" step="0.1" value={inputs.surfaceM2} onChange={(v) => onUpdate("surfaceM2", v)} />
        {inputs.surfaceM2 > 0 && (
          <div className="flex items-end">
            <span className="text-[11px] text-muted-foreground leading-snug">
              Avant : <span className="font-bold text-foreground">{Math.round(inputs.prixAchat / inputs.surfaceM2).toLocaleString("fr-FR")} EUR/m2</span>
              <br />
              Apres : <span className="font-bold text-foreground">{Math.round((inputs.prixAchat + inputs.montantTravaux) / inputs.surfaceM2).toLocaleString("fr-FR")} EUR/m2</span>
            </span>
          </div>
        )}
      </div>

      <SectionLabel>Travaux</SectionLabel>
      <TravauxEditor lots={inputs.lotsTravaux ?? []} onChange={(lots) => {
        onUpdate("lotsTravaux", lots);
        onUpdate("montantTravaux", lots.reduce((s, l) => s + (l.montant || 0), 0));
      }} />

      <SectionLabel>Mobilier</SectionLabel>
      <MobilierEditor lots={inputs.lotsMobilier ?? []} onChange={(lots) => onUpdate("lotsMobilier", lots)} />

      <SectionLabel>Loyers mensuels</SectionLabel>
      <LotsEditor lots={inputs.lots ?? []} onChange={(lots) => onUpdate("lots", lots)} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumField label="Differe de loyer" suffix="mois" value={inputs.differeLoyer} onChange={(v) => onUpdate("differeLoyer", v)} />
        <NumField label="Taux de vacance" suffix="%" step="0.1" value={Math.round(inputs.tauxVacance * 1000) / 10} onChange={(v) => onUpdate("tauxVacance", v / 100)} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumField label="Autres revenus" suffix="EUR/an" value={inputs.autresRevenusAnnuels} onChange={(v) => onUpdate("autresRevenusAnnuels", v)} />
      </div>
      <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Indexation loyers (IRL)</Label>
        <input
          type="number"
          step="0.1"
          value={Math.round((inputs.evolutions?.lopiloyer ?? 0.006) * 10000) / 100 || ""}
          onChange={(e) => {
            const val = Number(e.target.value) / 100;
            onUpdate("evolutions", { ...inputs.evolutions, lopiloyer: val });
          }}
          className="flex h-7 w-16 rounded-md border border-input bg-transparent px-2 text-xs text-right outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <span className="text-[11px] text-muted-foreground">%/an</span>
      </div>

    </div>
  );
}

/* ── Charges annuelles card ── */

function ChargesSummary({ inputs }: { inputs: CalculatorInputs }) {
  const lotsCount = inputs.lots?.length || 1;
  const comptaBase = inputs.comptabilite || (80 * lotsCount);
  const loyerAnnuelBrut = (inputs.lots ?? []).reduce((s, l) => s + (l.loyerMensuel || 0), 0) * 12 + inputs.autresRevenusAnnuels;
  const loyerAnnuelNet = loyerAnnuelBrut * (1 - inputs.tauxVacance);
  const gestionAnnuelle = loyerAnnuelNet * inputs.gestionLocativePct;

  const lines: { label: string; annuel: number }[] = [
    { label: "Copropriete", annuel: inputs.chargesCopro },
    { label: "Taxe fonciere", annuel: inputs.taxeFonciere },
    { label: "Assurance PNO", annuel: inputs.assurancePNO },
    { label: "Gestion locative", annuel: gestionAnnuelle },
    { label: "Comptabilite", annuel: comptaBase },
    { label: "CFE / CRL", annuel: inputs.cfeCrl },
    { label: "Entretien", annuel: inputs.entretien },
    { label: "GLI", annuel: inputs.gli },
    { label: "Autres charges", annuel: inputs.autresChargesAnnuelles },
  ].filter((l) => l.annuel > 0);

  const totalAnnuel = lines.reduce((s, l) => s + l.annuel, 0);

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 pt-1">Recap mensuel</p>
      <div className="text-[11px] space-y-0.5">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between text-muted-foreground">
            <span>{l.label}</span>
            <span className="tabular-nums font-medium text-foreground">{Math.round(l.annuel / 12).toLocaleString("fr-FR")} EUR/m</span>
          </div>
        ))}
        <div className="flex items-center justify-between font-bold text-foreground pt-1 border-t border-dashed border-muted-foreground/20">
          <span>Total</span>
          <span className="tabular-nums">{Math.round(totalAnnuel / 12).toLocaleString("fr-FR")} EUR/m &middot; {Math.round(totalAnnuel).toLocaleString("fr-FR")} EUR/an</span>
        </div>
      </div>
    </div>
  );
}

export function ChargesCard({ inputs, onUpdate }: CalculatorFormProps) {
  return (
    <div className="border border-dotted rounded-lg p-5 space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider">Charges annuelles</h2>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumField label="Copropriete" suffix="EUR/an" value={inputs.chargesCopro} onChange={(v) => onUpdate("chargesCopro", v)} />
            <NumField label="Taxe fonciere" suffix="EUR/an" value={inputs.taxeFonciere} onChange={(v) => onUpdate("taxeFonciere", v)} />
            <NumField label="Assurance PNO" suffix="EUR/an" value={inputs.assurancePNO} onChange={(v) => onUpdate("assurancePNO", v)} />
            <ToggleEurPct
              label="Gestion locative"
              pctValue={inputs.gestionLocativePct}
              eurValue={Math.round(inputs.gestionLocativePct * ((inputs.lots ?? []).reduce((s, l) => s + (l.loyerMensuel || 0), 0) * 12 * (1 - inputs.tauxVacance)))}
              onChangePct={(v) => onUpdate("gestionLocativePct", v)}
              onChangeEur={(v) => {
                const loyerNet = (inputs.lots ?? []).reduce((s, l) => s + (l.loyerMensuel || 0), 0) * 12 * (1 - inputs.tauxVacance);
                onUpdate("gestionLocativePct", loyerNet > 0 ? v / loyerNet : 0);
              }}
              suffix="an"
            />
            <NumField label="Comptabilite" suffix="EUR/an" value={inputs.comptabilite} onChange={(v) => onUpdate("comptabilite", v)} />
            <NumField label="CFE / CRL" suffix="EUR/an" value={inputs.cfeCrl} onChange={(v) => onUpdate("cfeCrl", v)} />
            <NumField label="Entretien" suffix="EUR/an" value={inputs.entretien} onChange={(v) => onUpdate("entretien", v)} />
            <NumField label="GLI" suffix="EUR/an" value={inputs.gli} onChange={(v) => onUpdate("gli", v)} />
          </div>
          <NumField label="Autres charges" suffix="EUR/an" value={inputs.autresChargesAnnuelles} onChange={(v) => onUpdate("autresChargesAnnuelles", v)} />
        </div>
        <ChargesSummary inputs={inputs} />
      </div>
    </div>
  );
}

/* ── Right column: Financement + Fiscalite ── */

export function FinancementCard({ inputs, onUpdate }: CalculatorFormProps) {
  const mobilierTotal = (inputs.lotsMobilier ?? []).reduce((s, l) => s + (l.montant || 0), 0);
  const coutProjet = inputs.prixAchat + (inputs.prixAchat * inputs.fraisNotairePct) + inputs.fraisAgence + inputs.montantTravaux + mobilierTotal + (inputs.fraisDossier ?? 0) + (inputs.fraisCourtage ?? 0);
  const apport = inputs.apportPersonnel ?? 0;
  const empruntAuto = Math.max(0, Math.round(coutProjet - apport));
  const totalFinance = inputs.montantEmprunte + apport;
  const sousFinance = totalFinance > 0 && totalFinance < Math.round(coutProjet);
  const surFinance = totalFinance > Math.round(coutProjet);

  const handleApportChange = (v: number) => {
    onUpdate("apportPersonnel", v);
    // Auto-update emprunt
    const newEmprunt = Math.max(0, Math.round(coutProjet - v));
    onUpdate("montantEmprunte", newEmprunt);
  };

  return (
    <div className="border border-dotted rounded-lg p-5 space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider">Financement</h2>

      <div className="flex items-end justify-between">
        <span className="text-[11px] text-muted-foreground">
          Cout total du projet : <span className="font-bold text-foreground">{Math.round(coutProjet).toLocaleString("fr-FR")} EUR</span>
        </span>
        <button
          type="button"
          onClick={() => onUpdate("montantEmprunte", empruntAuto)}
          className="text-[10px] text-primary hover:underline"
        >
          Recalculer emprunt
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumField label="Apport personnel" suffix="EUR" value={inputs.apportPersonnel} onChange={handleApportChange} />
        <NumField label="Montant emprunte" suffix="EUR" value={inputs.montantEmprunte} onChange={(v) => onUpdate("montantEmprunte", v)} />
      </div>

      {sousFinance && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
          Apport + emprunt ({totalFinance.toLocaleString("fr-FR")} EUR) &lt; cout du projet ({Math.round(coutProjet).toLocaleString("fr-FR")} EUR). Il manque {Math.round(coutProjet - totalFinance).toLocaleString("fr-FR")} EUR.
        </div>
      )}
      {surFinance && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
          Apport + emprunt ({totalFinance.toLocaleString("fr-FR")} EUR) &gt; cout du projet ({Math.round(coutProjet).toLocaleString("fr-FR")} EUR). Excedent de {Math.round(totalFinance - coutProjet).toLocaleString("fr-FR")} EUR.
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <SelectField
          label="Type de pret"
          value={inputs.typePret}
          onChange={(v) => onUpdate("typePret", v as LoanType)}
          options={[
            { value: "amortissable", label: "Amortissable" },
            { value: "in_fine", label: "In fine" },
          ]}
        />
        <NumField label="Taux nominal" suffix="%" step="0.01" value={Math.round(inputs.tauxCredit * 10000) / 100} onChange={(v) => onUpdate("tauxCredit", v / 100)} />
        <NumField label="Duree" suffix="ans" value={inputs.dureeCredit} onChange={(v) => onUpdate("dureeCredit", v)} />
        <NumField label="Differe partiel" suffix="mois" value={inputs.differePretMois} onChange={(v) => onUpdate("differePretMois", v)} />
        {(inputs.differePretMois ?? 0) > 0 && (
          <SelectField
            label="Differe"
            value={inputs.differePretInclus ? "inclus" : "en_plus"}
            onChange={(v) => onUpdate("differePretInclus", v === "inclus")}
            options={[
              { value: "inclus", label: "Inclus dans la duree" },
              { value: "en_plus", label: "En plus de la duree" },
            ]}
          />
        )}
        <SelectField
          label="Assurance pret"
          value={inputs.assurancePretMode}
          onChange={(v) => onUpdate("assurancePretMode", v as AssurancePretMode)}
          options={[
            { value: "eur", label: "EUR/an" },
            { value: "pct", label: "% capital" },
          ]}
        />
        {inputs.assurancePretMode === "eur" ? (
          <NumField label="Assurance" suffix="EUR/an" value={inputs.assurancePretAnnuelle} onChange={(v) => onUpdate("assurancePretAnnuelle", v)} />
        ) : (
          <NumField label="Taux assurance" suffix="%" step="0.01" value={Math.round(inputs.assurancePretPct * 10000) / 100} onChange={(v) => onUpdate("assurancePretPct", v / 100)} />
        )}
        <NumField label="Frais de dossier" suffix="EUR" value={inputs.fraisDossier} onChange={(v) => onUpdate("fraisDossier", v)} />
        <NumField label="Frais de courtage" suffix="EUR" value={inputs.fraisCourtage} onChange={(v) => onUpdate("fraisCourtage", v)} />
      </div>

      {inputs.montantEmprunte > 0 && inputs.dureeCredit > 0 && (() => {
        const assAn = inputs.assurancePretMode === 'pct' ? inputs.montantEmprunte * inputs.assurancePretPct : inputs.assurancePretAnnuelle;
        const t = inputs.tauxCredit / 12 || 0.003;
        const diffMois = inputs.differePretMois ?? 0;
        const dureeAmortMois = (inputs.differePretInclus ?? true)
          ? inputs.dureeCredit * 12 - diffMois
          : inputs.dureeCredit * 12;
        const mensCredit = dureeAmortMois > 0 && inputs.tauxCredit > 0
          ? inputs.montantEmprunte * (t * Math.pow(1 + t, dureeAmortMois)) / (Math.pow(1 + t, dureeAmortMois) - 1)
          : inputs.montantEmprunte / Math.max(1, dureeAmortMois);
        const mensTotale = mensCredit + assAn / 12;
        // Newton-Raphson TAEG
        let r = inputs.tauxCredit / 12;
        const n = inputs.dureeCredit * 12;
        for (let i = 0; i < 100; i++) {
          const f = Math.pow(1 + r, n);
          const pv = mensTotale * (f - 1) / (r * f);
          const dr = 0.00001;
          const f2 = Math.pow(1 + r + dr, n);
          const pv2 = mensTotale * (f2 - 1) / ((r + dr) * f2);
          const newR = r - (pv - inputs.montantEmprunte) / ((pv2 - pv) / dr);
          if (Math.abs(newR - r) < 1e-10) break;
          r = Math.max(0.0001, newR);
        }
        const taeg = r * 12 * 100;
        return (
          <span className="text-[11px] text-muted-foreground">
            Mensualite : <span className="font-bold text-foreground">{Math.round(mensTotale).toLocaleString("fr-FR")} EUR</span>
            {" · "}TAEG (estime) : <span className="font-bold text-foreground">{taeg.toFixed(2)} %</span>
          </span>
        );
      })()}

      <SectionLabel>Projection</SectionLabel>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumField label="Appreciation" suffix="%/an" step="0.1" value={Math.round(inputs.tauxAppreciation * 1000) / 10} onChange={(v) => onUpdate("tauxAppreciation", v / 100)} />
        <NumField label="Duree detention" suffix="ans" value={inputs.dureeDetention} onChange={(v) => onUpdate("dureeDetention", v)} />
      </div>
    </div>
  );
}

function AmortissementSummary({ inputs }: { inputs: CalculatorInputs }) {
  const fraisNotaire = inputs.prixAchat * inputs.fraisNotairePct;
  const valeurBatiment = inputs.prixAchat * 0.80;
  const mobilierTotal = (inputs.lotsMobilier ?? []).reduce((s, l) => s + (l.montant || 0), 0);
  const lotsTravaux = inputs.lotsTravaux ?? [];

  const lines: { label: string; montant: number; duree: number; annuel: number }[] = [
    { label: "Bien (80% prix)", montant: valeurBatiment, duree: AMORT_DUREES.bien, annuel: valeurBatiment / AMORT_DUREES.bien },
    { label: "Frais de notaire", montant: fraisNotaire, duree: AMORT_DUREES.notaire, annuel: fraisNotaire / AMORT_DUREES.notaire },
  ];
  if (inputs.fraisAgence > 0) {
    lines.push({ label: "Frais d'agence", montant: inputs.fraisAgence, duree: AMORT_DUREES.agence, annuel: inputs.fraisAgence / AMORT_DUREES.agence });
  }
  if (mobilierTotal > 0) {
    lines.push({ label: "Meubles", montant: mobilierTotal, duree: AMORT_DUREES.meubles, annuel: mobilierTotal / AMORT_DUREES.meubles });
  }
  for (const lot of lotsTravaux) {
    if (lot.montant > 0) {
      lines.push({ label: lot.nom, montant: lot.montant, duree: lot.dureeAmortissement, annuel: lot.montant / lot.dureeAmortissement });
    }
  }

  const totalAn1 = lines.reduce((s, l) => s + l.annuel, 0);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 pt-1">Amortissements</p>
      <div className="text-[11px] space-y-0.5">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between text-muted-foreground">
            <span className="truncate flex-1">{l.label}</span>
            <span className="shrink-0 tabular-nums ml-2">{Math.round(l.montant).toLocaleString("fr-FR")} / {l.duree}a</span>
            <span className="shrink-0 tabular-nums ml-2 w-20 text-right font-medium text-foreground">= {Math.round(l.annuel).toLocaleString("fr-FR")} EUR</span>
          </div>
        ))}
        <div className="flex items-center justify-between font-bold text-foreground pt-1 border-t border-dashed border-muted-foreground/20">
          <span>Total amort. annee 1</span>
          <span className="tabular-nums">{Math.round(totalAn1).toLocaleString("fr-FR")} EUR</span>
        </div>
      </div>
    </div>
  );
}

export function FiscaliteCard({ inputs, onUpdate }: CalculatorFormProps) {
  return (
    <div className="border border-dotted rounded-lg p-5 space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider">Fiscalite</h2>

      <SelectField
        label="Regime fiscal"
        value={inputs.regimeFiscal}
        onChange={(v) => onUpdate("regimeFiscal", v as TaxRegime)}
        options={[
          { value: "IR", label: "SCI a l'IR" },
          { value: "IS", label: "SCI a l'IS" },
        ]}
      />
      {inputs.regimeFiscal === "IR" ? (
        <SelectField
          label="Tranche marginale d'imposition"
          value={String(inputs.trancheMarginalePct ?? 0.30)}
          onChange={(v) => onUpdate("trancheMarginalePct", Number(v))}
          options={TMI_TRANCHES.map((t) => ({
            value: String(t),
            label: `${(t * 100).toFixed(0)} %`,
          }))}
        />
      ) : (
        <AmortissementSummary inputs={inputs} />
      )}
    </div>
  );
}
