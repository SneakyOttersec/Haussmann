"use client";

import { useState } from "react";
import type { Lot, LotStatut, EntreeHistoriqueLoyer, StatutBien } from "@/types";
import { STATUT_BIEN_ORDER } from "@/types";
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
  bienId: string;
  propertyStatut?: StatutBien;
  /** Optional override for the section card title (defaults to "Lots"). */
  title?: string;
  /** Taux de vacance global (0..1) — quand defini, ecrase celui des lots. */
  tauxVacanceGlobal?: number;
  /** Callback pour modifier le taux global. Si absent, l'input n'est pas affiche. */
  onUpdateTauxVacanceGlobal?: (value: number | undefined) => void;
  /** Callback pour reviser le loyer d'un lot : met a jour le lot + les suiviLoyers futurs. */
  onReviserLoyer?: (lotId: string, nouveauMontant: number, dateEffet: string) => void;
}

function isEnLocation(statut?: StatutBien): boolean {
  if (!statut) return true;
  const idx = STATUT_BIEN_ORDER.indexOf(statut);
  const locIdx = STATUT_BIEN_ORDER.indexOf("location");
  return idx >= locIdx;
}

const LOT_STATUT_CYCLE: LotStatut[] = ["vacant", "occupe", "travaux"];
const LOT_STATUT_LABELS: Record<LotStatut, string> = { occupe: "Occupe", vacant: "Vacant", travaux: "Travaux" };
const LOT_STATUT_STYLE: Record<LotStatut, string> = {
  occupe: "bg-green-100 text-green-700",
  vacant: "bg-red-100 text-red-600",
  travaux: "bg-amber-100 text-amber-700",
};

function LotRow({ lot: l, onUpdate, onDelete, enLocation, propertyStatut, onReviserLoyer }: {
  lot: Lot;
  enLocation: boolean;
  onUpdate: (id: string, updates: Partial<Lot>) => void;
  onDelete: (id: string) => void;
  propertyStatut?: StatutBien;
  onReviserLoyer?: (lotId: string, nouveauMontant: number, dateEffet: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revision, setRevision] = useState({ montant: l.loyerMensuel, dateEffet: new Date().toISOString().slice(0, 10) });
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
    // Warn if the bien is in "travaux" and user tries to move lot AWAY from travaux
    if (propertyStatut === "travaux" && l.statut === "travaux" && next !== "travaux") {
      setConfirmOverride(next);
    } else {
      onUpdate(l.id, { statut: next });
    }
  };

  const history = (l.historiqueLoyers ?? []).sort((a, b) => a.date.localeCompare(b.date)); // chronological
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);

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
      const newEntry: EntreeHistoriqueLoyer = { id: generateId(), date: new Date().toISOString().slice(0, 10), montant: edit.loyerMensuel };
      updates.historiqueLoyers = [...(l.historiqueLoyers ?? []), newEntry];
    }
    onUpdate(l.id, updates);
    setEditOpen(false);
  };

  // Revisions with computed periods
  const revisions = history.map((h, i) => {
    const debut = h.date;
    const fin = i < history.length - 1 ? history[i + 1].date : null; // null = en cours
    const isActuel = i === history.length - 1;
    return { ...h, debut, fin, isActuel, index: i + 1 };
  });
  const firstEntry = history.length > 0 ? history[0] : null;
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
          {revisions.length > 1 && (
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${evolution >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}
              title={historyOpen ? "Masquer les revisions" : "Afficher les revisions"}
            >
              {revisions.length - 1} rev. · {evolution >= 0 ? "+" : ""}{evolution.toFixed(1)}%
            </button>
          )}
          {onReviserLoyer && (
            <button
              onClick={() => { setRevision({ montant: l.loyerMensuel, dateEffet: new Date().toISOString().slice(0, 10) }); setRevisionOpen(true); }}
              className="text-[10px] px-1.5 py-0.5 rounded border border-dotted border-primary/30 text-primary hover:bg-primary/5 transition-colors shrink-0"
              title="Reviser le loyer (indexation IRL, nouveau bail...)"
            >
              Reviser
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

        {/* Revision tabs */}
        {historyOpen && revisions.length > 0 && (
          <div className="pb-2 space-y-2">
            {/* Tab bar */}
            <div className="flex flex-wrap items-center gap-1 pl-0.5">
              {revisions.map((r) => {
                const isSelected = selectedRevision === r.id || (selectedRevision === null && r.isActuel);
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRevision(r.id)}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                      r.isActuel && isSelected
                        ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                        : isSelected
                        ? "border-muted-foreground/40 bg-muted/30 text-foreground font-medium"
                        : "border-dotted border-muted-foreground/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.isActuel ? "Actuel" : `Rev. ${r.index}`}
                    <span className="ml-1 tabular-nums opacity-70">{formatCurrency(r.montant)}</span>
                  </button>
                );
              })}
            </div>
            {/* Selected revision detail */}
            {(() => {
              const sel = revisions.find((r) => r.id === selectedRevision) ?? revisions[revisions.length - 1];
              if (!sel) return null;
              const prevRev = sel.index > 1 ? revisions[sel.index - 2] : null;
              const variation = prevRev ? sel.montant - prevRev.montant : 0;
              const variationPct = prevRev && prevRev.montant > 0 ? (variation / prevRev.montant * 100) : 0;
              return (
                <div className="pl-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Periode : <span className="text-foreground font-medium">{sel.debut}</span>
                    {" → "}
                    <span className="text-foreground font-medium">{sel.fin ?? "en cours"}</span>
                  </span>
                  <span>
                    Montant : <span className="text-foreground font-medium tabular-nums">{formatCurrency(sel.montant)}/mois</span>
                  </span>
                  {prevRev && (
                    <span className={variation >= 0 ? "text-green-600" : "text-red-600"}>
                      {variation >= 0 ? "+" : ""}{formatCurrency(variation)}/m ({variation >= 0 ? "+" : ""}{variationPct.toFixed(1)}%)
                    </span>
                  )}
                  {sel.isActuel && (
                    <span className="text-[9px] text-primary font-medium">en vigueur</span>
                  )}
                  {/* Delete revision — only if more than 1 revision exists (can't delete the only one) */}
                  {revisions.length > 1 && (
                    <button
                      onClick={() => {
                        const remaining = (l.historiqueLoyers ?? []).filter((h) => h.id !== sel.id);
                        // If deleting the current revision, revert loyerMensuel to the previous one
                        const sorted = remaining.sort((a, b) => a.date.localeCompare(b.date));
                        const newLoyer = sorted.length > 0 ? sorted[sorted.length - 1].montant : l.loyerMensuel;
                        onUpdate(l.id, { historiqueLoyers: remaining, loyerMensuel: newLoyer });
                        setSelectedRevision(null);
                      }}
                      className="text-destructive/70 hover:text-destructive text-[10px] transition-colors"
                      title="Supprimer cette revision"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Revision loyer dialog */}
      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reviser le loyer — {l.nom}</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (onReviserLoyer && revision.montant > 0 && revision.montant !== l.loyerMensuel) {
                onReviserLoyer(l.id, revision.montant, revision.dateEffet);
              }
              setRevisionOpen(false);
            }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Loyer actuel :</span>
              <span className="font-medium text-foreground tabular-nums">{formatCurrency(l.loyerMensuel)}/mois</span>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nouveau loyer (EUR/mois)</Label>
              <Input
                type="number"
                min={0}
                autoFocus
                value={revision.montant || ""}
                onChange={(e) => setRevision({ ...revision, montant: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date d&apos;effet</Label>
              <Input
                type="date"
                value={revision.dateEffet}
                onChange={(e) => setRevision({ ...revision, dateEffet: e.target.value })}
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Les suivis de loyers futurs (a partir de ce mois) seront automatiquement ajustes au nouveau montant.
              </p>
            </div>
            {revision.montant > 0 && revision.montant !== l.loyerMensuel && (
              <div className={`text-[11px] p-2 rounded ${revision.montant > l.loyerMensuel ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {revision.montant > l.loyerMensuel ? "+" : ""}{formatCurrency(revision.montant - l.loyerMensuel)}/mois
                ({revision.montant > l.loyerMensuel ? "+" : ""}{((revision.montant - l.loyerMensuel) / l.loyerMensuel * 100).toFixed(1)}%)
              </div>
            )}
            <Button type="submit" className="w-full" disabled={revision.montant <= 0 || revision.montant === l.loyerMensuel}>
              Appliquer la revision
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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

      {/* Warning popup: forcing a lot out of "travaux" while bien is in travaux */}
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

export function SectionLots({ lots, onAdd, onUpdate, onDelete, bienId, propertyStatut, title, tauxVacanceGlobal, onUpdateTauxVacanceGlobal, onReviserLoyer }: Props) {
  const enLocation = isEnLocation(propertyStatut);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", etage: "", surface: 0, loyerMensuel: 0, statut: "vacant" as LotStatut, tauxVacancePct: 0 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: EntreeHistoriqueLoyer = { id: generateId(), date: new Date().toISOString().slice(0, 10), montant: form.loyerMensuel };
    const { tauxVacancePct, ...rest } = form;
    onAdd({
      ...rest,
      bienId,
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
                <LotRow key={l.id} lot={l} onUpdate={onUpdate} onDelete={onDelete} enLocation={enLocation} propertyStatut={propertyStatut} onReviserLoyer={onReviserLoyer} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
