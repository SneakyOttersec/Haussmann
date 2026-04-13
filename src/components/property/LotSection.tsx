"use client";

import { useState } from "react";
import type { Lot, LotStatut, RentHistoryEntry, PropertyStatus } from "@/types";
import { PROPERTY_STATUS_ORDER } from "@/types";
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
  propertyStatut?: PropertyStatus;
  /** Optional override for the section card title (defaults to "Lots"). */
  title?: string;
  /** Taux de vacance global (0..1) — quand defini, ecrase celui des lots. */
  tauxVacanceGlobal?: number;
  /** Callback pour modifier le taux global. Si absent, l'input n'est pas affiche. */
  onUpdateTauxVacanceGlobal?: (value: number | undefined) => void;
}

function isEnLocation(statut?: PropertyStatus): boolean {
  if (!statut) return true;
  const idx = PROPERTY_STATUS_ORDER.indexOf(statut);
  const locIdx = PROPERTY_STATUS_ORDER.indexOf("location");
  return idx >= locIdx;
}

const LOT_STATUT_CYCLE: LotStatut[] = ["vacant", "occupe", "travaux"];
const LOT_STATUT_LABELS: Record<LotStatut, string> = { occupe: "Occupe", vacant: "Vacant", travaux: "Travaux" };
const LOT_STATUT_STYLE: Record<LotStatut, string> = {
  occupe: "bg-green-100 text-green-700",
  vacant: "bg-red-100 text-red-600",
  travaux: "bg-amber-100 text-amber-700",
};

function LotRow({ lot: l, onUpdate, onDelete, enLocation, propertyStatut }: {
  lot: Lot;
  enLocation: boolean;
  onUpdate: (id: string, updates: Partial<Lot>) => void;
  onDelete: (id: string) => void;
  propertyStatut?: PropertyStatus;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmOverride, setConfirmOverride] = useState<LotStatut | null>(null);
  const [edit, setEdit] = useState({
    nom: l.nom,
    etage: l.etage || "",
    surface: l.surface || 0,
    loyerMensuel: l.loyerMensuel,
    statut: l.statut,
    tauxVacancePct: ((l.tauxVacance ?? 0) * 100),
  });

  const handleStatutToggle = () => {
    const idx = LOT_STATUT_CYCLE.indexOf(l.statut);
    const next = LOT_STATUT_CYCLE[(idx + 1) % LOT_STATUT_CYCLE.length];
    // Warn if the property is in "travaux" and user tries to move lot AWAY from travaux
    if (propertyStatut === "travaux" && l.statut === "travaux" && next !== "travaux") {
      setConfirmOverride(next);
    } else {
      onUpdate(l.id, { statut: next });
    }
  };

  const history = (l.historiqueLoyers ?? []).sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const { tauxVacancePct, ...rest } = edit;
    const updates: Partial<Lot> = {
      ...rest,
      etage: rest.etage || undefined,
      surface: rest.surface || undefined,
      tauxVacance: tauxVacancePct > 0 ? tauxVacancePct / 100 : undefined,
    };
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
      <div className="border-b border-dashed border-muted-foreground/10 last:border-0 py-2 space-y-1">
        <div className="flex items-center gap-2 sm:gap-3 text-sm flex-wrap">
          <button
            className="font-medium text-left hover:text-primary transition-colors cursor-pointer truncate min-w-0"
            onClick={() => { setEdit({ nom: l.nom, etage: l.etage || "", surface: l.surface || 0, loyerMensuel: l.loyerMensuel, statut: l.statut, tauxVacancePct: (l.tauxVacance ?? 0) * 100 }); setEditOpen(true); }}
          >
            {l.nom}
          </button>
          <button
            onClick={handleStatutToggle}
            className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors cursor-pointer hover:opacity-80 ${LOT_STATUT_STYLE[l.statut]}`}
            title="Clic pour changer le statut"
          >
            {LOT_STATUT_LABELS[l.statut]}
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
        {/* Ligne de details : etage, surface, vacance — toujours affichee */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground pl-0.5 flex-wrap">
          <span>
            Etage : <span className="text-foreground font-medium">{l.etage || "—"}</span>
          </span>
          <span>
            Surface : <span className="text-foreground font-medium tabular-nums">{l.surface ? `${l.surface} m²` : "—"}</span>
          </span>
          <span>
            Vacance : <span className={`font-medium tabular-nums ${(l.tauxVacance ?? 0) > 0 ? "text-amber-700" : "text-foreground"}`}>
              {(l.tauxVacance ?? 0) > 0 ? `${((l.tauxVacance ?? 0) * 100).toFixed(1)} %` : "—"}
            </span>
          </span>
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Vacance locative theorique (%)
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={edit.tauxVacancePct || ""}
                onChange={(e) => setEdit({ ...edit, tauxVacancePct: Number(e.target.value) })}
                placeholder="Ex: 5 pour 5%/an"
              />
              <p className="text-[10px] text-muted-foreground">
                Pourcentage du temps moyen pendant lequel le lot est vacant. Reduit le revenu theorique a pleine occupation.
              </p>
            </div>
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Warning popup: forcing a lot out of "travaux" while property is in travaux */}
      {confirmOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfirmOverride(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative border border-amber-500/30 rounded-lg p-5 bg-background shadow-lg w-full max-w-sm mx-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold">Forcer le statut du lot ?</h3>
            <p className="text-sm text-muted-foreground">
              Le bien est actuellement en phase <strong>Travaux</strong>.
              Passer le lot &quot;{l.nom}&quot; en <strong>{LOT_STATUT_LABELS[confirmOverride]}</strong> va
              forcer un statut different de celui du bien.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmOverride(null)}>
                Annuler
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  onUpdate(l.id, { statut: confirmOverride });
                  setConfirmOverride(null);
                }}
              >
                Forcer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Mini-editor inline pour le taux de vacance global. Suit le design pattern
 * de ApportSection (affichage → clic → input → Enter/Blur → sauvegarde).
 * La valeur n'est committed que sur validation explicite pour eviter les
 * ecritures a chaque keystroke.
 */
function VacanceGlobaleEditor({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value != null ? String(value * 100) : "");

  // Resync quand value change depuis l'exterieur.
  const resetDraft = () => setDraft(value != null ? String(value * 100) : "");

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onChange(undefined);
    } else {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        onChange(Math.max(0, Math.min(100, num)) / 100);
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    resetDraft();
    setEditing(false);
  };

  return (
    <span className="flex items-center gap-1.5 ml-auto">
      <span className="text-muted-foreground" title="Si defini, ecrase le taux de chaque lot">
        Vacance globale :
      </span>
      {editing ? (
        <>
          <Input
            autoFocus
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
            onBlur={commit}
            placeholder="—"
            className="w-20 h-7 text-[11px] px-2 tabular-nums"
          />
          <span className="text-muted-foreground">%</span>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); commit(); }}
            className="text-[10px] px-1.5 py-0.5 rounded border border-dotted border-primary/40 text-primary hover:bg-primary/5 transition-colors"
            title="Valider (Entree)"
          >
            OK
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); cancel(); }}
            className="text-[10px] px-1.5 py-0.5 rounded border border-dotted border-muted-foreground/40 text-muted-foreground hover:text-foreground transition-colors"
            title="Annuler (Echap)"
          >
            Annuler
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => { resetDraft(); setEditing(true); }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dotted border-muted-foreground/30 hover:border-primary/50 hover:text-primary transition-colors tabular-nums"
            title="Cliquer pour modifier"
          >
            {value != null ? `${(value * 100).toFixed(1)} %` : <span className="text-muted-foreground/70">—</span>}
            <span className="text-[9px] opacity-50">✎</span>
          </button>
          {value != null && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-muted-foreground/60 hover:text-destructive text-sm leading-none"
              title="Revenir aux taux par lot"
            >
              ×
            </button>
          )}
        </>
      )}
    </span>
  );
}

export function LotSection({ lots, onAdd, onUpdate, onDelete, propertyId, propertyStatut, title, tauxVacanceGlobal, onUpdateTauxVacanceGlobal }: Props) {
  const enLocation = isEnLocation(propertyStatut);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", etage: "", surface: 0, loyerMensuel: 0, statut: "vacant" as LotStatut, tauxVacancePct: 0 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: RentHistoryEntry = { id: generateId(), date: new Date().toISOString().slice(0, 10), montant: form.loyerMensuel };
    const { tauxVacancePct, ...rest } = form;
    onAdd({
      ...rest,
      propertyId,
      surface: form.surface || undefined,
      etage: form.etage || undefined,
      tauxVacance: tauxVacancePct > 0 ? tauxVacancePct / 100 : undefined,
      historiqueLoyers: [entry],
    });
    setOpen(false);
    setForm({ nom: "", etage: "", surface: 0, loyerMensuel: 0, statut: "vacant", tauxVacancePct: 0 });
  };

  const totalLoyer = lots.reduce((s, l) => s + l.loyerMensuel, 0);
  // Si un taux global est defini, il ecrase les taux par lot.
  const effectiveVacanceForLot = (l: Lot) =>
    tauxVacanceGlobal != null ? tauxVacanceGlobal : (l.tauxVacance ?? 0);
  const totalLoyerEffectif = lots.reduce(
    (s, l) => s + l.loyerMensuel * (1 - effectiveVacanceForLot(l)),
    0,
  );
  const hasVacance =
    (tauxVacanceGlobal != null && tauxVacanceGlobal > 0) ||
    lots.some((l) => (l.tauxVacance ?? 0) > 0);
  const occupes = lots.filter(l => l.statut === "occupe").length;
  const tauxOccupation = lots.length > 0 ? Math.round((occupes / lots.length) * 100) : 0;

  return (
    <Card className="border-dotted">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{title ?? "Lots"}</CardTitle>
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
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Vacance locative theorique (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={form.tauxVacancePct || ""}
                  onChange={(e) => setForm({ ...form, tauxVacancePct: Number(e.target.value) })}
                  placeholder="Ex: 5 pour 5%/an"
                />
                <p className="text-[10px] text-muted-foreground">
                  Pourcentage du temps moyen pendant lequel le lot est vacant. Reduit le revenu theorique a pleine occupation.
                </p>
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
            <div className="flex gap-4 text-[11px] text-muted-foreground mb-3 flex-wrap items-center">
              <span>Loyer total : <strong className="text-foreground">{formatCurrency(totalLoyer)}/mois</strong></span>
              {hasVacance && (
                <span title={tauxVacanceGlobal != null ? "Loyer apres application du taux de vacance global" : "Loyer apres application du taux de vacance theorique lot par lot"}>
                  Effectif : <strong className="text-foreground">{formatCurrency(totalLoyerEffectif)}/mois</strong>
                </span>
              )}
              <span>Occupation : {enLocation
                ? <strong className={occupes === lots.length ? "text-green-600" : "text-foreground"}>{tauxOccupation}% ({occupes}/{lots.length})</strong>
                : <strong className="text-muted-foreground">N/A</strong>
              }</span>
              {onUpdateTauxVacanceGlobal && (
                <VacanceGlobaleEditor
                  value={tauxVacanceGlobal}
                  onChange={onUpdateTauxVacanceGlobal}
                />
              )}
            </div>
            {tauxVacanceGlobal != null && tauxVacanceGlobal > 0 && lots.some((l) => (l.tauxVacance ?? 0) > 0) && (
              <p className="text-[10px] text-amber-700 mb-2 italic">
                Le taux global {(tauxVacanceGlobal * 100).toFixed(1)}% ecrase les taux par lot.
              </p>
            )}
            <div>
              {lots.map((l) => (
                <LotRow key={l.id} lot={l} onUpdate={onUpdate} onDelete={onDelete} enLocation={enLocation} propertyStatut={propertyStatut} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
