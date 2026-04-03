"use client";

import { useState } from "react";
import type { Lot, LotStatut, RentHistoryEntry } from "@/types";
import { formatCurrency, generateId } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  lots: Lot[];
  onAdd: (data: Omit<Lot, "id">) => void;
  onUpdate: (id: string, updates: Partial<Lot>) => void;
  onDelete: (id: string) => void;
  propertyId: string;
}

function LotRow({ lot: l, onUpdate, onDelete }: {
  lot: Lot;
  onUpdate: (id: string, updates: Partial<Lot>) => void;
  onDelete: (id: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [edit, setEdit] = useState({ nom: l.nom, etage: l.etage || "", surface: l.surface || 0, loyerMensuel: l.loyerMensuel, statut: l.statut });

  const history = (l.historiqueLoyers ?? []).sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<Lot> = { ...edit, etage: edit.etage || undefined, surface: edit.surface || undefined };
    // Auto-track rent change
    if (edit.loyerMensuel !== l.loyerMensuel) {
      const newEntry: RentHistoryEntry = { id: generateId(), date: new Date().toISOString().slice(0, 10), montant: edit.loyerMensuel };
      updates.historiqueLoyers = [...(l.historiqueLoyers ?? []), newEntry];
    }
    onUpdate(l.id, updates);
    setEditOpen(false);
  };

  // First and last entry for evolution display
  const firstEntry = history.length > 0 ? history[history.length - 1] : null;
  const evolution = firstEntry && firstEntry.montant > 0
    ? ((l.loyerMensuel - firstEntry.montant) / firstEntry.montant * 100)
    : 0;

  return (
    <>
      <div className="border-b border-dashed border-muted-foreground/10 last:border-0">
        <div className="flex items-center gap-3 text-sm py-2">
          <button
            className="font-medium text-left hover:text-primary transition-colors cursor-pointer"
            onClick={() => { setEdit({ nom: l.nom, etage: l.etage || "", surface: l.surface || 0, loyerMensuel: l.loyerMensuel, statut: l.statut }); setEditOpen(true); }}
          >
            {l.nom}
          </button>
          {l.etage && <span className="text-xs text-muted-foreground">{l.etage}</span>}
          {l.surface ? <span className="text-xs text-muted-foreground">{l.surface} m²</span> : null}
          <button
            onClick={() => onUpdate(l.id, { statut: l.statut === "occupe" ? "vacant" : "occupe" })}
            className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors ${
              l.statut === "occupe" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            }`}
          >
            {l.statut === "occupe" ? "Occupe" : "Vacant"}
          </button>
          <span className="flex-1" />
          <span className="font-medium tabular-nums shrink-0">{formatCurrency(l.loyerMensuel)}/m</span>
          {history.length > 1 && (
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${evolution >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}
            >
              {evolution >= 0 ? "+" : ""}{evolution.toFixed(1)}%
            </button>
          )}
          <button onClick={() => onDelete(l.id)} className="text-destructive text-sm hover:opacity-70 shrink-0">×</button>
        </div>

        {/* Rent history */}
        {historyOpen && history.length > 0 && (
          <div className="pb-2 pl-4 space-y-0.5">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="w-20">{h.date}</span>
                <span className="font-medium tabular-nums text-foreground">{formatCurrency(h.montant)}/m</span>
                {h.id === history[0].id && <span className="text-[9px] text-primary">actuel</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le lot</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom du lot</Label>
                <Input value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Etage</Label>
                <Input value={edit.etage} onChange={(e) => setEdit({ ...edit, etage: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Surface (m²)</Label>
                <Input type="number" min={0} value={edit.surface || ""} onChange={(e) => setEdit({ ...edit, surface: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Loyer mensuel (EUR)</Label>
                <Input type="number" min={0} value={edit.loyerMensuel || ""} onChange={(e) => setEdit({ ...edit, loyerMensuel: Number(e.target.value) })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Statut</Label>
              <div className="flex gap-2">
                {(["occupe", "vacant"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setEdit({ ...edit, statut: s })}
                    className={`px-3 py-1 rounded-md text-xs transition-colors ${edit.statut === s ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground"}`}
                  >{s === "occupe" ? "Occupe" : "Vacant"}</button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LotSection({ lots, onAdd, onUpdate, onDelete, propertyId }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", etage: "", surface: 0, loyerMensuel: 0, statut: "vacant" as LotStatut });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: RentHistoryEntry = { id: generateId(), date: new Date().toISOString().slice(0, 10), montant: form.loyerMensuel };
    onAdd({
      ...form,
      propertyId,
      surface: form.surface || undefined,
      etage: form.etage || undefined,
      historiqueLoyers: [entry],
    });
    setOpen(false);
    setForm({ nom: "", etage: "", surface: 0, loyerMensuel: 0, statut: "vacant" });
  };

  const totalLoyer = lots.reduce((s, l) => s + l.loyerMensuel, 0);
  const occupes = lots.filter(l => l.statut === "occupe").length;
  const tauxOccupation = lots.length > 0 ? Math.round((occupes / lots.length) * 100) : 0;

  return (
    <Card className="border-dotted">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Lots</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>+ Lot</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajouter un lot</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom du lot</Label>
                  <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Ex: T2 RDC" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Etage</Label>
                  <Input value={form.etage} onChange={(e) => setForm({ ...form, etage: e.target.value })} placeholder="Ex: RDC, 1er" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Surface (m²)</Label>
                  <Input type="number" min={0} value={form.surface || ""} onChange={(e) => setForm({ ...form, surface: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Loyer mensuel (EUR)</Label>
                  <Input type="number" min={0} value={form.loyerMensuel || ""} onChange={(e) => setForm({ ...form, loyerMensuel: Number(e.target.value) })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Statut</Label>
                <div className="flex gap-2">
                  {(["occupe", "vacant"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, statut: s })}
                      className={`px-3 py-1 rounded-md text-xs transition-colors ${form.statut === s ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground"}`}
                    >{s === "occupe" ? "Occupe" : "Vacant"}</button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full">Ajouter</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {lots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun lot enregistre.</p>
        ) : (
          <>
            <div className="flex gap-4 text-[11px] text-muted-foreground mb-3">
              <span>Loyer total : <strong className="text-foreground">{formatCurrency(totalLoyer)}/mois</strong></span>
              <span>Occupation : <strong className={occupes === lots.length ? "text-green-600" : "text-foreground"}>{tauxOccupation}% ({occupes}/{lots.length})</strong></span>
            </div>
            <div>
              {lots.map((l) => (
                <LotRow key={l.id} lot={l} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
