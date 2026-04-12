"use client";

import { useState, useRef } from "react";
import type { Intervention, InterventionStatut, InterventionType, Lot } from "@/types";
import { INTERVENTION_STATUT_LABELS } from "@/types";
import { formatCurrency, checkFileSize } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/ui/confirm-delete";

interface Props {
  interventions: Intervention[];
  onAdd: (data: Omit<Intervention, "id" | "createdAt" | "updatedAt">) => void;
  onUpdate: (id: string, updates: Partial<Intervention>) => void;
  onDelete: (id: string) => void;
  propertyId: string;
  filterType: InterventionType;
  lots?: Lot[];
  /** Only meaningful for filterType === "travaux": the loan's travaux envelope. */
  enveloppeCredit?: number;
  /** True if the travaux envelope is still open (date not passed). Defaults to true. */
  enveloppeOuverte?: boolean;
}

function LotSelect({ value, onChange, lots }: { value: string; onChange: (v: string) => void; lots: Lot[] }) {
  if (lots.length === 0) return null;
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Lot</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="">Bien entier</option>
        {lots.map((l) => (
          <option key={l.id} value={l.id}>{l.nom}</option>
        ))}
      </select>
    </div>
  );
}

function InterventionRow({ intervention: i, onUpdate, onDelete, lots, showNotes, showCreditToggle, enveloppeOuverte = true }: {
  intervention: Intervention;
  onUpdate: (id: string, updates: Partial<Intervention>) => void;
  onDelete: (id: string) => void;
  lots: Lot[];
  showNotes: boolean;
  showCreditToggle: boolean;
  enveloppeOuverte?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({
    description: i.description, prestataire: i.prestataire, montant: i.montant,
    date: i.date, statut: i.statut, lotId: i.lotId ?? "", notes: i.notes ?? "",
    financeParCredit: !!i.financeParCredit,
  });

  const lotName = i.lotId ? lots.find(l => l.id === i.lotId)?.nom : null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !checkFileSize(file)) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate(i.id, {
        pieceJointe: { nom: file.name, data: reader.result as string, type: file.type, taille: file.size },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const downloadPJ = () => {
    if (!i.pieceJointe) return;
    const a = document.createElement("a");
    a.href = i.pieceJointe.data;
    a.download = i.pieceJointe.nom;
    a.click();
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(i.id, {
      ...edit,
      lotId: edit.lotId || undefined,
      notes: edit.notes || undefined,
      financeParCredit: showCreditToggle ? edit.financeParCredit : undefined,
    });
    setEditOpen(false);
  };

  return (
    <>
      <div className="py-2 border-b border-dashed border-muted-foreground/10 last:border-0">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-xs text-muted-foreground w-20 shrink-0">{i.date}</span>
          <button
            onClick={() => {
              const next: InterventionStatut = i.statut === "planifie" ? "en_cours" : i.statut === "en_cours" ? "termine" : "planifie";
              onUpdate(i.id, { statut: next });
            }}
            className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors ${
              i.statut === "termine" ? "bg-green-100 text-green-700" : i.statut === "en_cours" ? "bg-yellow-100 text-yellow-700" : "bg-muted text-muted-foreground"
            }`}
            title="Clic pour changer le statut"
          >
            {INTERVENTION_STATUT_LABELS[i.statut]}
          </button>
          <button
            className="flex-1 truncate text-left hover:text-primary transition-colors cursor-pointer"
            onClick={() => { setEdit({ description: i.description, prestataire: i.prestataire, montant: i.montant, date: i.date, statut: i.statut, lotId: i.lotId ?? "", notes: i.notes ?? "", financeParCredit: !!i.financeParCredit }); setEditOpen(true); }}
          >
            {i.description}
          </button>
          {lotName && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{lotName}</span>}
          {i.prestataire && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{i.prestataire}</span>}
          <span className="font-medium tabular-nums shrink-0">{formatCurrency(i.montant)}</span>
          {showCreditToggle && (() => {
            // Can't newly mark as credit-funded if the envelope date has passed.
            // Already-checked items can still be unchecked (in case of error).
            const canCheck = enveloppeOuverte || !!i.financeParCredit;
            return (
              <label
                className={`flex items-center gap-1 text-[10px] shrink-0 select-none ${canCheck ? "cursor-pointer text-muted-foreground" : "cursor-not-allowed text-muted-foreground/40"}`}
                title={canCheck ? "Cocher si ce travaux est finance par l'enveloppe travaux du credit" : "Enveloppe travaux expiree — impossible d'ajouter de nouveaux financements"}
              >
                <input
                  type="checkbox"
                  checked={!!i.financeParCredit}
                  disabled={!canCheck}
                  onChange={(e) => onUpdate(i.id, { financeParCredit: e.target.checked })}
                  className="accent-primary h-3 w-3 cursor-[inherit] disabled:opacity-40"
                />
                <span className={i.financeParCredit ? "text-primary font-medium" : ""}>Credit</span>
              </label>
            );
          })()}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
              title="Joindre un devis/facture"
            >
              {i.pieceJointe ? "📎" : "＋📎"}
            </button>
            <ConfirmDelete label={i.description} onConfirm={() => onDelete(i.id)} />
          </div>
        </div>
        {i.pieceJointe && (
          <div className="flex items-center gap-2 mt-1 ml-[calc(5rem+0.75rem)]">
            <span className="text-[10px] text-muted-foreground">📎</span>
            <button onClick={downloadPJ} className="text-[11px] text-primary hover:underline truncate">{i.pieceJointe.nom}</button>
            <button onClick={() => onUpdate(i.id, { pieceJointe: undefined })} className="text-[10px] text-destructive hover:opacity-70">×</button>
          </div>
        )}
        {showNotes && i.notes && (
          <p className="text-[11px] text-muted-foreground mt-1 ml-[calc(5rem+0.75rem)] italic">{i.notes}</p>
        )}
        <input ref={fileRef} type="file" onChange={handleFile} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
              <Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Prestataire</Label>
                <Input value={edit.prestataire} onChange={(e) => setEdit({ ...edit, prestataire: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant (EUR)</Label>
                <Input type="number" min={0} step="0.01" value={edit.montant || ""} onChange={(e) => setEdit({ ...edit, montant: Number(e.target.value) })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
                <Input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Statut</Label>
                <div className="flex gap-1.5">
                  {Object.entries(INTERVENTION_STATUT_LABELS).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setEdit({ ...edit, statut: k as InterventionStatut })}
                      className={`px-2 py-1 rounded-md text-xs transition-colors ${edit.statut === k ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground"}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
            </div>
            <LotSelect value={edit.lotId} onChange={(v) => setEdit({ ...edit, lotId: v })} lots={lots} />
            {showCreditToggle && (
              <label className={`flex items-center gap-2 text-sm select-none ${enveloppeOuverte || edit.financeParCredit ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                <input
                  type="checkbox"
                  checked={edit.financeParCredit}
                  disabled={!enveloppeOuverte && !edit.financeParCredit}
                  onChange={(e) => setEdit({ ...edit, financeParCredit: e.target.checked })}
                  className="accent-primary"
                />
                <span className={edit.financeParCredit ? "text-foreground font-medium" : "text-muted-foreground"}>
                  Finance par l&apos;enveloppe travaux du credit
                  {!enveloppeOuverte && !edit.financeParCredit && <span className="text-destructive text-xs ml-1">(enveloppe expiree)</span>}
                </span>
              </label>
            )}
            {showNotes && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                <textarea
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
                  placeholder="Details, suivi, remarques..."
                />
              </div>
            )}
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const SECTION_LABELS: Record<InterventionType, { title: string; addLabel: string; addPlaceholder: string; emptyLabel: string }> = {
  travaux: {
    title: "Travaux",
    addLabel: "+ Travaux",
    addPlaceholder: "Ex: Refection toiture",
    emptyLabel: "Aucun travaux enregistre.",
  },
  intervention: {
    title: "Interventions",
    addLabel: "+ Intervention",
    addPlaceholder: "Ex: Reparation fuite",
    emptyLabel: "Aucune intervention enregistree.",
  },
};

export function InterventionSection({ interventions, onAdd, onUpdate, onDelete, propertyId, filterType, lots = [], enveloppeCredit, enveloppeOuverte = true }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", prestataire: "", montant: 0, date: new Date().toISOString().slice(0, 10), statut: "planifie" as InterventionStatut, lotId: "", notes: "", financeParCredit: false });
  const labels = SECTION_LABELS[filterType];
  const showNotes = filterType === "travaux";
  // Credit-envelope tracking only makes sense for travaux.
  const showCreditToggle = filterType === "travaux";

  const filtered = interventions.filter(i => (i.interventionType ?? "intervention") === filterType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...form,
      propertyId,
      interventionType: filterType,
      lotId: form.lotId || undefined,
      notes: showNotes && form.notes ? form.notes : undefined,
      financeParCredit: showCreditToggle ? form.financeParCredit : undefined,
    });
    setOpen(false);
    setForm({ description: "", prestataire: "", montant: 0, date: new Date().toISOString().slice(0, 10), statut: "planifie", lotId: "", notes: "", financeParCredit: false });
  };

  const totalDepense = filtered.filter(i => i.statut === "termine").reduce((s, i) => s + i.montant, 0);
  const totalPlanifie = filtered.filter(i => i.statut !== "termine").reduce((s, i) => s + i.montant, 0);
  // Sum of travaux explicitly funded by the credit envelope (all statuses).
  const totalFinanceParCredit = showCreditToggle
    ? filtered.filter(i => i.financeParCredit).reduce((s, i) => s + i.montant, 0)
    : 0;
  const enveloppe = enveloppeCredit ?? 0;
  const enveloppeRestante = Math.max(0, enveloppe - totalFinanceParCredit);
  const enveloppePct = enveloppe > 0 ? Math.round((totalFinanceParCredit / enveloppe) * 100) : 0;
  const enveloppeOverflow = totalFinanceParCredit > enveloppe;

  return (
    <Card className="border-dotted">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{labels.title}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>{labels.addLabel}</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajouter — {labels.title}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder={labels.addPlaceholder} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Prestataire</Label>
                  <Input value={form.prestataire} onChange={(e) => setForm({ ...form, prestataire: e.target.value })} placeholder="Nom du prestataire" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant (EUR)</Label>
                  <Input type="number" min={0} step="0.01" value={form.montant || ""} onChange={(e) => setForm({ ...form, montant: Number(e.target.value) })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Statut</Label>
                  <div className="flex gap-1.5">
                    {Object.entries(INTERVENTION_STATUT_LABELS).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setForm({ ...form, statut: k as InterventionStatut })}
                        className={`px-2 py-1 rounded-md text-xs transition-colors ${form.statut === k ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground"}`}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <LotSelect value={form.lotId} onChange={(v) => setForm({ ...form, lotId: v })} lots={lots} />
              {showCreditToggle && (
                <label className={`flex items-center gap-2 text-sm select-none ${enveloppeOuverte ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                  <input
                    type="checkbox"
                    checked={form.financeParCredit}
                    disabled={!enveloppeOuverte}
                    onChange={(e) => setForm({ ...form, financeParCredit: e.target.checked })}
                    className="accent-primary"
                  />
                  <span className={form.financeParCredit ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Finance par l&apos;enveloppe travaux du credit
                    {!enveloppeOuverte && <span className="text-destructive text-xs ml-1">(enveloppe expiree)</span>}
                  </span>
                </label>
              )}
              {showNotes && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
                    placeholder="Details, suivi, remarques..."
                  />
                </div>
              )}
              <Button type="submit" className="w-full">Ajouter</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.emptyLabel}</p>
        ) : (
          <>
            <div className="flex gap-4 text-[11px] text-muted-foreground mb-1">
              <span>Depense : <strong className="text-foreground">{formatCurrency(totalDepense)}</strong></span>
              <span>Planifie : <strong className="text-foreground">{formatCurrency(totalPlanifie)}</strong></span>
            </div>
            {showCreditToggle && (
              <p className="text-[11px] text-muted-foreground mb-3">
                Finance par credit :{" "}
                <strong className={enveloppeOverflow ? "text-destructive" : "text-foreground"}>
                  {formatCurrency(totalFinanceParCredit)}
                </strong>
                {enveloppe > 0 ? (
                  <>
                    {" "}sur <strong className="text-foreground">{formatCurrency(enveloppe)}</strong>{" "}
                    d&apos;enveloppe travaux ({enveloppePct}%)
                    {enveloppeOverflow ? (
                      <span className="text-destructive ml-1">— depassement de {formatCurrency(totalFinanceParCredit - enveloppe)}</span>
                    ) : (
                      <span className="text-muted-foreground/70 ml-1">— reste {formatCurrency(enveloppeRestante)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground/70 ml-1">
                    — pas d&apos;enveloppe travaux definie sur le credit
                  </span>
                )}
              </p>
            )}
            <div>
              {filtered.sort((a, b) => b.date.localeCompare(a.date)).map((i) => (
                <InterventionRow
                  key={i.id}
                  intervention={i}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  lots={lots}
                  showNotes={showNotes}
                  showCreditToggle={showCreditToggle}
                  enveloppeOuverte={enveloppeOuverte}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
