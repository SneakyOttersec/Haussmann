"use client";

import { useState, useRef } from "react";
import type { Intervention, InterventionStatut } from "@/types";
import { INTERVENTION_STATUT_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  interventions: Intervention[];
  onAdd: (data: Omit<Intervention, "id" | "createdAt" | "updatedAt">) => void;
  onUpdate: (id: string, updates: Partial<Intervention>) => void;
  onDelete: (id: string) => void;
  propertyId: string;
}

function InterventionRow({ intervention: i, onUpdate, onDelete }: {
  intervention: Intervention;
  onUpdate: (id: string, updates: Partial<Intervention>) => void;
  onDelete: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ description: i.description, prestataire: i.prestataire, montant: i.montant, date: i.date, statut: i.statut });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Max 5 Mo"); return; }
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
    onUpdate(i.id, edit);
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
            onClick={() => { setEdit({ description: i.description, prestataire: i.prestataire, montant: i.montant, date: i.date, statut: i.statut }); setEditOpen(true); }}
          >
            {i.description}
          </button>
          {i.prestataire && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{i.prestataire}</span>}
          <span className="font-medium tabular-nums shrink-0">{formatCurrency(i.montant)}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
              title="Joindre un devis/facture"
            >
              {i.pieceJointe ? "📎" : "＋📎"}
            </button>
            <button onClick={() => onDelete(i.id)} className="text-destructive text-sm hover:opacity-70">×</button>
          </div>
        </div>
        {i.pieceJointe && (
          <div className="flex items-center gap-2 mt-1 ml-[calc(5rem+0.75rem)]">
            <span className="text-[10px] text-muted-foreground">📎</span>
            <button onClick={downloadPJ} className="text-[11px] text-primary hover:underline truncate">{i.pieceJointe.nom}</button>
            <button onClick={() => onUpdate(i.id, { pieceJointe: undefined })} className="text-[10px] text-destructive hover:opacity-70">×</button>
          </div>
        )}
        <input ref={fileRef} type="file" onChange={handleFile} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l&apos;intervention</DialogTitle></DialogHeader>
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
                <Input type="number" min={0} value={edit.montant || ""} onChange={(e) => setEdit({ ...edit, montant: Number(e.target.value) })} required />
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
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InterventionSection({ interventions, onAdd, onUpdate, onDelete, propertyId }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", prestataire: "", montant: 0, date: new Date().toISOString().slice(0, 10), statut: "planifie" as InterventionStatut });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ ...form, propertyId });
    setOpen(false);
    setForm({ description: "", prestataire: "", montant: 0, date: new Date().toISOString().slice(0, 10), statut: "planifie" });
  };

  const totalDepense = interventions.filter(i => i.statut === "termine").reduce((s, i) => s + i.montant, 0);
  const totalPlanifie = interventions.filter(i => i.statut !== "termine").reduce((s, i) => s + i.montant, 0);

  return (
    <Card className="border-dotted">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Travaux & Interventions</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>+ Intervention</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajouter une intervention</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="Ex: Refection toiture" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Prestataire</Label>
                  <Input value={form.prestataire} onChange={(e) => setForm({ ...form, prestataire: e.target.value })} placeholder="Nom du prestataire" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant (EUR)</Label>
                  <Input type="number" min={0} value={form.montant || ""} onChange={(e) => setForm({ ...form, montant: Number(e.target.value) })} required />
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
              <Button type="submit" className="w-full">Ajouter</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {interventions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune intervention enregistree.</p>
        ) : (
          <>
            <div className="flex gap-4 text-[11px] text-muted-foreground mb-3">
              <span>Depense : <strong className="text-foreground">{formatCurrency(totalDepense)}</strong></span>
              <span>Planifie : <strong className="text-foreground">{formatCurrency(totalPlanifie)}</strong></span>
            </div>
            <div>
              {interventions.sort((a, b) => b.date.localeCompare(a.date)).map((i) => (
                <InterventionRow key={i.id} intervention={i} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
