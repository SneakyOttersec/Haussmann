"use client";

import { Suspense, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDonnees } from "@/hooks/useLocalStorage";
import { useBiens } from "@/hooks/useBiens";
import { useDepenses } from "@/hooks/useDepenses";
import { useRevenus } from "@/hooks/useRevenus";
import { usePrets } from "@/hooks/usePrets";
import { useInterventions } from "@/hooks/useInterventions";
import { useContacts } from "@/hooks/useContacts";
import { useDocuments } from "@/hooks/useDocuments";
import { useLots } from "@/hooks/useLots";
import { TYPE_BIEN_LABELS } from "@/types";
import type { StatutBien, Bien, Pret, AllocationCredit, Intervention } from "@/types";
import { STATUT_BIEN_ORDER, STATUT_BIEN_LABELS } from "@/types";
import { formatCurrency, checkFileSize, coutTotalBien, enveloppeTravauxFinDate, estEnveloppeTravauxOuverte, generateId, now } from "@/lib/utils";
import { calculerMensualite } from "@/lib/calculs";
import { mensualiteAmortissement, mensualitePendantDiffere, capitalApresDiffere } from "@/lib/calculs/pret";
import { CfTooltip } from "@/components/ui/cf-tooltip";
import { ResumeBien } from "@/components/bien/ResumeBien";
import { BarreStatutBien } from "@/components/bien/BarreStatutBien";
import { ListeDepenses } from "@/components/bien/ListeDepenses";
import { FormulaireDepense } from "@/components/bien/FormulaireDepense";
import { ListeRevenus } from "@/components/bien/ListeRevenus";
import { FormulaireRevenu } from "@/components/bien/FormulaireRevenu";
import { FormulairePret } from "@/components/bien/FormulairePret";
import { TableauAmortissementPret } from "@/components/bien/TableauAmortissementPret";
import dynamic from "next/dynamic";
import { useSuiviLoyers } from "@/hooks/useSuiviLoyers";

// recharts (~8.5 MB) is only used by these two — lazy-load to keep /biens cold-load light.
const GraphFluxMensuels = dynamic(
  () => import("@/components/bien/GraphFluxMensuels").then((m) => m.GraphFluxMensuels),
  { ssr: false, loading: () => <div className="h-[300px] border border-dashed rounded-md" /> }
);
const SectionReelVsSimule = dynamic(
  () => import("@/components/bien/SectionReelVsSimule").then((m) => m.SectionReelVsSimule),
  { ssr: false, loading: () => <div className="h-[495px] border border-dashed rounded-md" /> }
);
const GraphRendementMensuel = dynamic(
  () => import("@/components/bien/GraphRendementMensuel").then((m) => m.GraphRendementMensuel),
  { ssr: false, loading: () => <div className="h-[300px] border border-dashed rounded-md" /> }
);

// Below-the-fold sections — lazy-load to shrink /biens initial bundle.
// Each section is large (forms, tables, dialogs) and only relevant when the user scrolls to it.
const SectionLots = dynamic(
  () => import("@/components/bien/SectionLots").then((m) => m.SectionLots),
  { ssr: false, loading: () => <div className="h-[200px] border border-dashed rounded-md" /> }
);
const SectionInterventions = dynamic(
  () => import("@/components/bien/SectionInterventions").then((m) => m.SectionInterventions),
  { ssr: false, loading: () => <div className="h-[200px] border border-dashed rounded-md" /> }
);
const SectionContacts = dynamic(
  () => import("@/components/bien/SectionContacts").then((m) => m.SectionContacts),
  { ssr: false, loading: () => <div className="h-[200px] border border-dashed rounded-md" /> }
);
const SectionDocuments = dynamic(
  () => import("@/components/bien/SectionDocuments").then((m) => m.SectionDocuments),
  { ssr: false, loading: () => <div className="h-[200px] border border-dashed rounded-md" /> }
);
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { PieceJointePret } from "@/types";

function LoanExtras({ pret, onUpdate }: {
  pret: Pret;
  onUpdate: (updates: Partial<Pret>) => void;
}) {
  const [editBanque, setEditBanque] = useState(false);
  const [banqueDraft, setBanqueDraft] = useState(pret.banque || "");
  const fileRef = useRef<HTMLInputElement>(null);
  const docs = pret.documents ?? [];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !checkFileSize(file)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newDoc: PieceJointePret = {
        nom: file.name,
        data: reader.result as string,
        type: file.type,
        taille: file.size,
        ajouteLe: new Date().toISOString().slice(0, 10),
      };
      onUpdate({ documents: [...docs, newDoc] });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeDoc = (idx: number) => {
    onUpdate({ documents: docs.filter((_, i) => i !== idx) });
  };

  const downloadDoc = (doc: PieceJointePret) => {
    const a = document.createElement("a");
    a.href = doc.data;
    a.download = doc.nom;
    a.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/15">
      {/* Banque */}
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Banque</p>
        {editBanque ? (
          <input
            autoFocus
            value={banqueDraft}
            onChange={(e) => setBanqueDraft(e.target.value)}
            onBlur={() => { onUpdate({ banque: banqueDraft || undefined }); setEditBanque(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditBanque(false); }}
            className="h-7 px-2 text-sm border border-input rounded bg-transparent outline-none focus:border-ring flex-1"
            placeholder="Nom de la banque"
          />
        ) : (
          <button
            onClick={() => { setBanqueDraft(pret.banque || ""); setEditBanque(true); }}
            title="Cliquer pour modifier"
            className="inline-flex items-center gap-1.5 text-sm px-2 py-0.5 rounded border border-dashed border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            {pret.banque ? (
              <>
                <span>{pret.banque}</span>
                <span className="text-[10px] opacity-60">✎</span>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">+ Ajouter une banque</span>
            )}
          </button>
        )}
      </div>

      {/* Documents */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Documents credit</p>
        <button onClick={() => fileRef.current?.click()} className="text-[10px] text-primary hover:underline">+ Document</button>
      </div>
      <input ref={fileRef} type="file" onChange={handleFile} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      {docs.length > 0 && (
        <div className="space-y-1">
          {docs.map((doc, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className="text-xs">📄</span>
              <button onClick={() => downloadDoc(doc)} className="text-xs text-primary hover:underline truncate flex-1 text-left">{doc.nom}</button>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(doc.taille)}</span>
              <button onClick={() => removeDoc(idx)} className="text-destructive text-xs hover:opacity-70 shrink-0">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compute the credit allocation for a bien + pret. Uses the stored
 * allocationCredit when available; otherwise derives a default that
 * covers the full project cost (credit + apport). Shared by
 * AllocationSection (display) and the SectionInterventions call site
 * (enveloppe travaux).
 */
function calculerAllocationCredit(bien: Bien, pret: Pret): AllocationCredit {
  // Backfill dossier/garantie/mobilier on older allocations that predate those buckets.
  if (bien.allocationCredit) {
    const a = bien.allocationCredit as Partial<AllocationCredit> & Omit<AllocationCredit, "dossier" | "garantie" | "mobilier">;
    // Mobilier absent de l'allocation mais present sur la propriete : on le
    // backfill automatiquement pour que le cout total soit coherent.
    const mobilier = a.mobilier ?? bien.montantMobilier ?? 0;
    return {
      ...a,
      dossier: a.dossier ?? 0,
      garantie: a.garantie ?? 0,
      mobilier,
    };
  }
  // Default = full project cost split across buckets; user can then
  // redistribute to match the credit+apport financing.
  return {
    bien: bien.prixAchat,
    travaux: bien.montantTravaux,
    notaire: bien.fraisNotaire,
    agence: bien.fraisAgence,
    dossier: bien.fraisDossier ?? 0,
    garantie: 0,
    mobilier: bien.montantMobilier ?? 0,
    autre: bien.fraisCourtage ?? 0,
  };
}

function ApportSection({ bien, pret, onUpdateApport, onUpdateEmprunt }: {
  bien: Bien;
  pret: Pret;
  onUpdateApport: (v: number | undefined) => void;
  onUpdateEmprunt: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const coutTotal = coutTotalBien(bien);
  const apportDerive = Math.max(0, coutTotal - pret.montantEmprunte);
  const apport = bien.apport ?? apportDerive;
  const [draft, setDraft] = useState(String(apport));
  const isCustom = bien.apport != null;
  const totalFinance = pret.montantEmprunte + apport;
  const ecartProjet = totalFinance - coutTotal;

  const handleSave = () => {
    const v = Number(draft);
    if (!isNaN(v) && v >= 0) {
      onUpdateApport(v);
    }
    setEditing(false);
  };

  const handleReset = () => {
    onUpdateApport(undefined);
    setEditing(false);
  };

  const handleEquilibrer = () => {
    const newEmprunt = Math.max(0, Math.round(coutTotal - apport));
    onUpdateEmprunt(newEmprunt);
  };

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/15 space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Cout total du projet</span>
        <span className="font-medium tabular-nums">{formatCurrency(coutTotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Emprunt</span>
        <span className="font-medium tabular-nums">{formatCurrency(pret.montantEmprunte)}</span>
      </div>
      <div className="flex justify-between text-sm font-bold items-center">
        <span>Apport personnel</span>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="number"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              className="w-28 h-7 px-2 text-sm text-right border border-input rounded bg-transparent outline-none focus:border-ring tabular-nums"
            />
          </div>
        ) : (
          <button
            onClick={() => { setDraft(String(apport)); setEditing(true); }}
            className="tabular-nums inline-flex items-center gap-1.5 hover:text-primary transition-colors"
            title="Cliquer pour modifier l'apport"
          >
            {formatCurrency(apport)}
            <span className="text-[10px] opacity-50">✎</span>
          </button>
        )}
      </div>
      {isCustom && (
        <button onClick={handleReset} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
          Recalculer automatiquement
        </button>
      )}
      {coutTotal > 0 && apport > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Apport de {(apport / coutTotal * 100).toFixed(1)}% du projet.
        </p>
      )}
      {ecartProjet !== 0 && (
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-amber-600">
            {ecartProjet < 0
              ? `Emprunt + apport ne couvrent pas le projet (${formatCurrency(Math.abs(ecartProjet))} manquants).`
              : `Emprunt + apport depassent le cout du projet de ${formatCurrency(ecartProjet)}.`}
          </p>
          <button
            onClick={handleEquilibrer}
            className="text-[10px] text-primary hover:underline shrink-0"
          >
            Equilibrer le credit
          </button>
        </div>
      )}
    </div>
  );
}

function AllocationSection({ pret, bien, interventions, onSave, onUpdateLoan }: {
  pret: Pret;
  bien: Bien;
  interventions: Intervention[];
  onSave: (alloc: AllocationCredit) => void;
  onUpdateLoan: (updates: Partial<Pret>) => void;
}) {
  const defaultAlloc = calculerAllocationCredit(bien, pret);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState(defaultAlloc);

  // Travaux funded by the pret envelope — drives the small "x € sur y € utilises" hint
  // displayed right under the Travaux row.
  const travauxFinances = interventions
    .filter((i) => (i.interventionType ?? "intervention") === "travaux" && i.financeParCredit)
    .reduce((s, i) => s + i.montant, 0);
  const travauxEnveloppe = defaultAlloc.travaux;
  const travauxPct = travauxEnveloppe > 0 ? Math.round((travauxFinances / travauxEnveloppe) * 100) : 0;
  const travauxOverflow = travauxFinances > travauxEnveloppe;

  // Note: this list is rendered manually so we can interleave the travaux usage hint.
  const enveloppeFinDate = enveloppeTravauxFinDate(pret);
  const enveloppeOuverte = estEnveloppeTravauxOuverte(pret);

  const allocations: { key: keyof AllocationCredit; label: string; value: number }[] = [
    { key: "bien", label: "Bien immobilier", value: defaultAlloc.bien },
    { key: "notaire", label: "Frais de notaire", value: defaultAlloc.notaire },
    { key: "agence", label: "Frais d'agence", value: defaultAlloc.agence },
    { key: "dossier", label: "Frais de dossier", value: defaultAlloc.dossier ?? 0 },
    { key: "garantie", label: "Frais de garantie", value: defaultAlloc.garantie ?? 0 },
    { key: "travaux", label: "Travaux", value: defaultAlloc.travaux },
    { key: "mobilier", label: "Mobilier", value: defaultAlloc.mobilier ?? 0 },
    { key: "autre", label: "Autre", value: defaultAlloc.autre },
  ];
  const totalAlloue = allocations.reduce((s, a) => s + a.value, 0);
  // L'allocation doit couvrir le financement total = apport + credit, pas
  // uniquement le credit.
  const apport = bien.apport ?? 0;
  const financementTotal = pret.montantEmprunte + apport;
  const ecart = financementTotal - totalAlloue;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(edit);
    setEditOpen(false);
  };

  return (
    <>
      <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/15">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Allocation du financement</p>
          <button
            onClick={() => { setEdit(defaultAlloc); setEditOpen(true); }}
            className="text-[10px] text-primary hover:underline"
          >
            Modifier
          </button>
        </div>
        <div className="space-y-1 text-sm">
          {allocations
            .filter((a) => a.value > 0 || a.key === "dossier" || a.key === "garantie")
            .map((a) => (
            <div key={a.key}>
              {a.key === "travaux" && (
                <div className="flex items-center gap-2 pt-2 mt-1 border-t border-dotted border-muted-foreground/15">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Travaux et mobilier</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{a.label}</span>
                <span className="font-medium tabular-nums">{formatCurrency(a.value)}</span>
              </div>
              {a.key === "travaux" && (
                <div className="text-[10px] text-muted-foreground/80 ml-2 space-y-0.5">
                  <p>
                    ↳ utilise :{" "}
                    <span className={`tabular-nums ${travauxOverflow ? "text-destructive font-medium" : ""}`}>
                      {formatCurrency(travauxFinances)}
                    </span>
                    {" "}({travauxPct}%)
                    {travauxOverflow
                      ? <span className="text-destructive"> — depassement de {formatCurrency(travauxFinances - travauxEnveloppe)}</span>
                      : <span> — reste {formatCurrency(Math.max(0, travauxEnveloppe - travauxFinances))}</span>}
                  </p>
                  {travauxEnveloppe > 0 && (
                    <p className="flex items-center gap-1.5">
                      ↳ Déblocage possible jusqu&apos;au{" "}
                      <input
                        type="date"
                        value={enveloppeFinDate ?? ""}
                        onChange={(e) => onUpdateLoan({ enveloppeTravauxFinDate: e.target.value || undefined })}
                        className="h-5 px-1 text-[10px] border border-dashed border-muted-foreground/30 rounded bg-transparent focus:border-primary outline-none tabular-nums"
                      />
                      {enveloppeFinDate && !enveloppeOuverte && (
                        <span className="text-destructive font-medium">• expirée</span>
                      )}
                      {enveloppeOuverte && enveloppeFinDate && (
                        <span className="text-green-600">• ouverte</span>
                      )}
                      {pret.enveloppeTravauxFinDate && (
                        <button
                          onClick={() => onUpdateLoan({ enveloppeTravauxFinDate: undefined })}
                          className="text-muted-foreground/50 hover:text-primary text-[9px]"
                          title="Reinitialiser a la fin du differe"
                        >
                          reinitialiser
                        </button>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between pt-1 border-t border-dashed border-muted-foreground/10 font-bold">
            <span>Total alloue</span>
            <span className={`tabular-nums ${ecart === 0 ? "" : "text-amber-600"}`}>
              {formatCurrency(totalAlloue)} / {formatCurrency(financementTotal)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/80 mt-0.5">
            ↳ credit {formatCurrency(pret.montantEmprunte)} + apport {formatCurrency(apport)}
          </p>
          {ecart !== 0 && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-[10px] text-amber-600">
                {formatCurrency(Math.abs(ecart))} {ecart > 0 ? "non alloues" : "en trop"}
              </p>
              <button
                onClick={() => { setEdit(defaultAlloc); setEditOpen(true); }}
                className="text-[10px] text-primary hover:underline shrink-0"
              >
                Modifier l&apos;allocation
              </button>
              <button
                onClick={() => onUpdateLoan({ montantEmprunte: Math.max(0, totalAlloue - apport) })}
                className="text-[10px] text-primary hover:underline shrink-0"
              >
                Ajuster le credit a {formatCurrency(Math.max(0, totalAlloue - apport))}
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Allocation du financement</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {([
              { key: "bien", label: "Bien immobilier" },
              { key: "notaire", label: "Frais de notaire" },
              { key: "agence", label: "Frais d'agence" },
              { key: "dossier", label: "Frais de dossier" },
              { key: "garantie", label: "Frais de garantie" },
              { key: "travaux", label: "Travaux" },
              { key: "mobilier", label: "Mobilier" },
              { key: "autre", label: "Autre" },
            ] as const).map((field) => (
              <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <Label className="text-sm text-muted-foreground sm:w-40 shrink-0">{field.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={edit[field.key] || ""}
                  onChange={(e) => setEdit({ ...edit, [field.key]: Number(e.target.value) || 0 })}
                  className="text-right"
                />
              </div>
            ))}
            <div className="pt-2 border-t border-dashed border-muted-foreground/15 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold">Total alloue</span>
                <span className={`font-bold tabular-nums ${edit.bien + edit.travaux + edit.notaire + edit.agence + (edit.dossier ?? 0) + (edit.garantie ?? 0) + (edit.mobilier ?? 0) + edit.autre !== financementTotal ? "text-destructive" : "text-green-600"}`}>
                  {formatCurrency(edit.bien + edit.travaux + edit.notaire + edit.agence + (edit.dossier ?? 0) + (edit.garantie ?? 0) + (edit.mobilier ?? 0) + edit.autre)} / {formatCurrency(financementTotal)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5 text-right">
                credit {formatCurrency(pret.montantEmprunte)} + apport {formatCurrency(apport)}
              </p>
            </div>
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Bien is past the "acte" phase — financial data is meaningful */
function estPostActe(statut?: StatutBien): boolean {
  if (!statut) return true; // backward compat
  const idx = STATUT_BIEN_ORDER.indexOf(statut);
  const acteIdx = STATUT_BIEN_ORDER.indexOf("acte");
  return idx >= acteIdx;
}

function PropertyDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { data, setData } = useDonnees();
  const router = useRouter();
  const { obtenirBien, mettreAJourBien, supprimerBien } = useBiens(data, setData);
  const { depenses, ajouterDepense, mettreAJourDepense, supprimerDepense } = useDepenses(data, setData, id ?? undefined);
  const { revenus, ajouterRevenu, mettreAJourRevenu, supprimerRevenu } = useRevenus(data, setData, id ?? undefined);
  const { pret, setPret, supprimerPret } = usePrets(data, setData, id ?? undefined);
  const { interventions, ajouterIntervention, mettreAJourIntervention, supprimerIntervention } = useInterventions(data, setData, id ?? undefined);
  const { contacts, ajouterContact, mettreAJourContact, supprimerContact } = useContacts(data, setData, id ?? undefined);
  const { documents, ajouterDocument, supprimerDocument } = useDocuments(data, setData, id ?? undefined);
  const { lots, ajouterLot, mettreAJourLot, supprimerLot } = useLots(data, setData, id ?? undefined);
  const { entries: suiviLoyers } = useSuiviLoyers(data, setData, id ?? undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // Tracks whether we've already auto-synced lots for the current "travaux" session.
  // Reset when the bien leaves "travaux", so re-entering triggers a new sync.
  const travauxSyncedRef = useRef(false);
  // Snapshot "Projection actuelle" A1 remonte par SectionReelVsSimule —
  // source de verite partagee avec le graph pour la marge travaux / CF negatif.
  // Place ici (avant l'early return) pour respecter les rules of hooks.
  const [actuelSnapshot, setActuelSnapshot] = useState<{ loyerNetAnnuel: number; chargesAnnuelles: number } | null>(null);
  const [exportPdfOpen, setExportPdfOpen] = useState(false);
  const [exportPdfMode, setExportPdfMode] = useState<"demande_pret" | "suivi_interne" | "refinancement">("demande_pret");

  if (!data || !id) return null;

  const bien = obtenirBien(id);
  if (!bien) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Bien introuvable.</p>
        <Link href="/" className="text-primary hover:underline mt-2 inline-block">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  // ── Auto-sync lots to "travaux" on first detection ──
  // Runs once per "travaux session": syncs desynced lots when the bien
  // enters travaux (or when the page loads with bien already in travaux).
  // After the one-time sync, user overrides via the force-confirmation dialog
  // are respected — no re-sync until the bien leaves then re-enters travaux.
  if (bien.statut === "travaux") {
    if (!travauxSyncedRef.current) {
      const desyncedLots = lots.filter((l) => l.statut !== "travaux");
      if (desyncedLots.length > 0) {
        queueMicrotask(() => {
          for (const lot of desyncedLots) {
            mettreAJourLot(lot.id, { statut: "travaux" });
          }
        });
      }
      travauxSyncedRef.current = true;
    }
  } else {
    // Bien left travaux — reset the flag so re-entering triggers a new sync.
    travauxSyncedRef.current = false;
  }

  // Mensualite shown in the credit card = post-defer amortization payment.
  // For pre-acte prets with a defer, this is what the user will pay starting
  // month N+1 — it's the most informative number for the validation tickbox.
  const mensualiteCredit = pret ? mensualiteAmortissement(pret) : 0;
  const dM = pret?.differeMois ?? 0;
  const mensualiteDifferee = pret && dM > 0 ? mensualitePendantDiffere(pret) : 0;

  // ── Travaux envelope consumption → effective principal & monthly payment ──
  //
  // Real-life French banks release the travaux envelope progressively as the
  // borrower presents invoices. The effective amount drawn at any point in time
  // equals the pret total minus the unspent portion of the travaux envelope.
  // We recompute the mensualite on this effective principal so the user sees
  // what they actually pay today vs. what they'll pay once the envelope is
  // fully consumed.
  const travauxEnveloppeCredit = bien.allocationCredit?.travaux ?? 0;
  const travauxFinancesParCredit = interventions
    .filter((i) => (i.interventionType ?? "intervention") === "travaux" && i.financeParCredit)
    .reduce((s, i) => s + i.montant, 0);
  const travauxNonTires = pret
    ? Math.max(0, travauxEnveloppeCredit - travauxFinancesParCredit)
    : 0;
  const montantEmprunteEffectif = pret ? Math.max(0, pret.montantEmprunte - travauxNonTires) : 0;
  // Synthetic pret with the effective principal — drives both the mensualite
  // amortization phase and the differe-period interest payment.
  const loanEffectif = pret ? { ...pret, montantEmprunte: montantEmprunteEffectif } : null;
  const mensualiteEffective = loanEffectif ? mensualiteAmortissement(loanEffectif) : 0;
  const mensualiteDifferEffective = loanEffectif && dM > 0 ? mensualitePendantDiffere(loanEffectif) : 0;
  const showEffectif = pret != null && travauxNonTires > 0;

  // ── Marge travaux avant CF negatif ──
  // Principal P* qui fait basculer le CF annuel a 0 en regime post-differe :
  //   CF(P) = loyerNet − charges − assurance_annuelle − P × kEff × 12
  //   P* = (loyerNet − charges − assurance_annuelle) / (kEff × 12)
  //   marge = P* − montantEmprunteEffectif
  // kEff vient de `mensualiteAmortissement(loanEffectif) / montantEmprunteEffectif`
  // — gere correctement differeInclus + differe partiel/total (capitalisation).
  const breakEvenMarge: number | null = (() => {
    if (!pret || !loanEffectif || !actuelSnapshot) return null;
    if (montantEmprunteEffectif <= 0 || mensualiteEffective <= 0) return null;
    const { loyerNetAnnuel, chargesAnnuelles } = actuelSnapshot;
    const disponibleAvantCredit = loyerNetAnnuel - chargesAnnuelles - pret.assuranceAnnuelle;
    const kEff = mensualiteEffective / montantEmprunteEffectif;
    if (kEff <= 0) return null;
    const pStar = disponibleAvantCredit / (kEff * 12);
    return pStar - montantEmprunteEffectif;
  })();

  // Pre-acte = the bien is still being prospected/negotiated. While in this
  // state, financial values are projections — we color each price green when the
  // user has validated it against a real contract/offer, orange otherwise. Once
  // the bien is post-acte, prices are real and stay in the default colour.
  const isPreActe = !estPostActe(bien.statut);
  const creditValide = !!pret?.offerValidated;
  const priceClass = (validated: boolean): string =>
    isPreActe ? (validated ? "text-green-600" : "text-amber-600") : "";

  /**
   * Synchronise la depense "credit" avec les parametres actuels du pret.
   * Doit etre appele apres toute modification de montantEmprunte / tauxAnnuel
   * / dureeAnnees / differe / assurance pour garder la mensualite affichee
   * en accord avec le pret.
   */
  const syncCreditExpense = (loanData: Parameters<typeof setPret>[0]) => {
    const mensualite = mensualiteAmortissement(loanData);
    const assuranceMensuelle = loanData.assuranceAnnuelle / 12;
    const montantTotal = Math.round((mensualite + assuranceMensuelle) * 100) / 100;
    const creditExpense = depenses.find((e) => e.categorie === "credit");
    if (creditExpense) {
      mettreAJourDepense(creditExpense.id, { montant: montantTotal, dateDebut: loanData.dateDebut });
    } else {
      ajouterDepense({
        bienId: id,
        categorie: "credit",
        label: "Mensualite credit",
        montant: montantTotal,
        frequence: "mensuel",
        dateDebut: loanData.dateDebut,
        notes: "",
      });
    }
  };

  /**
   * Wrapper sur setPret qui re-synchronise systematiquement la depense
   * "credit". Toute mise a jour du pret (formulaire, allocation, LoanExtras,
   * onUpdateEmprunt) doit passer par ici.
   */
  const setPretSafe = (loanData: Parameters<typeof setPret>[0]) => {
    setPret(loanData);
    syncCreditExpense(loanData);
  };

  const handleSetLoan = setPretSafe;

  const handleDeleteLoan = (loanId: string) => {
    supprimerPret(loanId);
    const creditExpense = depenses.find((e) => e.categorie === "credit");
    if (creditExpense) {
      supprimerDepense(creditExpense.id);
    }
  };

  // Lot → Revenu sync: each lot creates/updates a matching revenu entry
  const handleAddLot = (lotData: Parameters<typeof ajouterLot>[0]) => {
    ajouterLot(lotData);
    ajouterRevenu({
      bienId: id,
      categorie: "loyer",
      label: lotData.nom || "Loyer",
      montant: lotData.loyerMensuel,
      frequence: "mensuel",
      dateDebut: new Date().toISOString().slice(0, 10),
      notes: `Lot: ${lotData.nom}`,
    });
  };

  const handleUpdateLot = (lotId: string, updates: Parameters<typeof mettreAJourLot>[1]) => {
    mettreAJourLot(lotId, updates);
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) return;
    const matchingIncome = revenus.find((i) => i.notes === `Lot: ${lot.nom}` && i.categorie === "loyer");
    if (matchingIncome) {
      const incUpdates: Record<string, unknown> = {};
      if (updates.loyerMensuel !== undefined) incUpdates.montant = updates.loyerMensuel;
      if (updates.nom !== undefined) {
        incUpdates.label = updates.nom;
        incUpdates.notes = `Lot: ${updates.nom}`;
      }
      if (Object.keys(incUpdates).length > 0) mettreAJourRevenu(matchingIncome.id, incUpdates);
    }
  };

  const handleDeleteLot = (lotId: string) => {
    const lot = lots.find((l) => l.id === lotId);
    supprimerLot(lotId);
    if (lot) {
      const matchingIncome = revenus.find((i) => i.notes === `Lot: ${lot.nom}` && i.categorie === "loyer");
      if (matchingIncome) supprimerRevenu(matchingIncome.id);
    }
  };

  /**
   * Reviser le loyer d'un lot :
   * 1. Met a jour lot.loyerMensuel + ajoute une entree historiqueLoyers
   * 2. Synchronise le revenu lie au lot (Income "loyer")
   * 3. Met a jour tous les suiviLoyers futurs (>= mois d'effet) qui avaient
   *    encore l'ancien loyerAttendu, pour refleter le nouveau montant.
   */
  const handleReviserLoyer = (lotId: string, nouveauMontant: number, dateEffet: string) => {
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) return;
    const ancienMontant = lot.loyerMensuel;

    // 1. Lot : loyerMensuel + historiqueLoyers
    const newEntry = { id: generateId(), date: dateEffet, montant: nouveauMontant };
    mettreAJourLot(lotId, {
      loyerMensuel: nouveauMontant,
      historiqueLoyers: [...(lot.historiqueLoyers ?? []), newEntry],
    });

    // 2. Revenu lie (Income "loyer")
    const matchingIncome = revenus.find((i) => i.notes === `Lot: ${lot.nom}` && i.categorie === "loyer");
    if (matchingIncome) mettreAJourRevenu(matchingIncome.id, { montant: nouveauMontant });

    // 3. SuiviLoyers futurs : ajuster loyerAttendu
    const effectiveYM = dateEffet.slice(0, 7); // "YYYY-MM"
    setData((prev) => ({
      ...prev,
      suiviLoyers: prev.suiviLoyers.map((e) => {
        if (e.lotId !== lotId) return e;
        if (e.yearMonth < effectiveYM) return e;
        // Ne touche que les entrees dont le loyerAttendu correspond a l'ancien
        // montant — pas les ajustements manuels.
        if (Math.round(e.loyerAttendu) !== Math.round(ancienMontant)) return e;
        return { ...e, loyerAttendu: nouveauMontant, updatedAt: now() };
      }),
    }));
  };

  // Intervention → Document sync: when a PJ is attached, mirror it in Documents
  const handleUpdateIntervention = (intId: string, updates: Parameters<typeof mettreAJourIntervention>[1]) => {
    mettreAJourIntervention(intId, updates);
    if (updates.pieceJointe) {
      const intervention = interventions.find((i) => i.id === intId);
      const label = intervention?.description ?? "Intervention";
      const typeLabel = (intervention?.interventionType ?? "intervention") === "travaux" ? "Travaux" : "Intervention";
      // Remove old linked doc if replacing
      const oldDoc = documents.find((d) => d.linkedInterventionId === intId);
      if (oldDoc) supprimerDocument(oldDoc.id);
      // Add new linked doc
      ajouterDocument({
        bienId: id,
        nom: `[${typeLabel}] ${label} — ${updates.pieceJointe.nom}`,
        categorie: "devis",
        data: updates.pieceJointe.data,
        type: updates.pieceJointe.type,
        taille: updates.pieceJointe.taille,
        ajouteLe: new Date().toISOString().slice(0, 10),
        linkedInterventionId: intId,
      });
    }
    if (updates.pieceJointe === undefined) {
      // PJ removed — remove linked doc
      const linkedDoc = documents.find((d) => d.linkedInterventionId === intId);
      if (linkedDoc) supprimerDocument(linkedDoc.id);
    }
  };

  const handleDeleteDocument = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (doc?.linkedInterventionId) {
      mettreAJourIntervention(doc.linkedInterventionId, { pieceJointe: undefined });
    }
    supprimerDocument(docId);
  };

  const handleDelete = () => {
    if (deleteConfirmText === bien.nom) {
      supprimerBien(id);
      router.push("/");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          ← Tableau de bord
        </Link>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mt-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="break-words">{bien.nom}</h1>
              <Badge variant="secondary">{TYPE_BIEN_LABELS[bien.type]}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 break-words">{bien.adresse}</p>
            <p className="text-sm text-muted-foreground">
              Achat : {formatCurrency(bien.prixAchat)} — {bien.dateSaisie}
              {bien.surfaceM2 ? ` — ${bien.surfaceM2} m²` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap md:justify-end">
            {/* Navigation : vues rattachees au bien */}
            <Link
              href={`/loyers?bienId=${id}`}
              className="px-2.5 py-1 text-xs rounded-md border border-dotted border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
              title="Ouvrir le suivi des loyers de ce bien"
            >
              Suivi loyers
            </Link>
            <Link
              href={`/simulateur?bienId=${id}`}
              className="px-2.5 py-1 text-xs rounded-md border border-dotted border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
              title="Ouvrir ce bien dans le simulateur"
            >
              Simuler
            </Link>
            {bien.simulationId && (
              <Link
                href={`/simulateur?simId=${bien.simulationId}`}
                className="px-2.5 py-1 text-xs rounded-md border border-dotted border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                title="Ouvrir la simulation initiale dont ce bien est issu"
              >
                Simulation initiale
              </Link>
            )}
            {/* Separateur visuel — masque sur mobile pour ne pas flotter en fin de ligne */}
            <span className="hidden md:inline-block w-px h-5 bg-muted-foreground/20 mx-1" aria-hidden />
            {/* Actions : export / modifier / supprimer */}
            <button
              onClick={() => setExportPdfOpen(true)}
              className="px-2.5 py-1 text-xs rounded-md border border-dotted border-teal-600/40 text-teal-700 hover:bg-teal-50 hover:border-teal-600/70 transition-colors"
              title="Exporter la fiche du bien en PDF"
            >
              Export PDF
            </button>
            <button
              onClick={async () => {
                const { exporterBusinessPlan } = await import("@/lib/businessPlan");
                const dureeAnnees = pret?.dureeAnnees ?? 20;
                const tauxInteret = pret?.tauxAnnuel ?? 0.035;
                const coutTotalEstime = bien.prixAchat + (bien.montantTravaux ?? 0) + (bien.montantMobilier ?? 0) + (bien.fraisNotaire ?? 0);
                const apportPct = coutTotalEstime > 0 && bien.apport
                  ? Math.min(1, bien.apport / coutTotalEstime)
                  : 0.10;
                const tauxAssurance = pret && pret.assuranceAnnuelle > 0 && pret.montantEmprunte > 0
                  ? pret.assuranceAnnuelle / pret.montantEmprunte
                  : 0.001;
                await exporterBusinessPlan({
                  bien,
                  lots,
                  depenses,
                  description: bien.notes,
                  dureeAnnees,
                  tauxInteret,
                  tauxAssurance,
                  apportPct,
                  montantEmprunteEffectif: pret ? montantEmprunteEffectif : undefined,
                  montantEmprunteTotal: pret?.montantEmprunte,
                });
              }}
              className="px-2.5 py-1 text-xs rounded-md border border-dotted border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600/70 transition-colors"
              title="Exporter un Business Plan Excel (format banquier)"
            >
              Business Plan
            </button>
            <Link
              href={`/biens/modifier?id=${id}`}
              className="px-2.5 py-1 text-xs rounded-md border border-dotted border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60 transition-colors"
            >
              Modifier
            </Link>
            <button
              onClick={() => { setDeleteConfirmText(""); setDeleteOpen(true); }}
              className="px-2.5 py-1 text-xs rounded-md border border-dotted border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/60 transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {/* Export PDF mode picker */}
      {exportPdfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setExportPdfOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative border border-teal-600/30 rounded-lg p-6 bg-background shadow-lg space-y-4 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-sm">Exporter la fiche en PDF</h3>
            <p className="text-sm text-muted-foreground">
              Choisissez le type de dossier. Le template, le ton et les sections mises en avant varient selon l&apos;usage.
            </p>
            <div className="space-y-2" role="radiogroup" aria-label="Type de dossier">
              {([
                { key: "demande_pret", label: "Demande de Prêt", desc: "Dossier pour soumettre à une banque un nouveau financement — focus sur projections, DSCR, LTV." },
                { key: "suivi_interne", label: "Suivi Interne", desc: "Vue d'ensemble neutre pour archivage ou suivi personnel — tous les détails, pas de mise en valeur." },
                { key: "refinancement", label: "Refinancement", desc: "Dossier pour renégocier un crédit existant — focus sur CRD, performance à date, conditions actuelles." },
              ] as const).map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
                    exportPdfMode === opt.key
                      ? "border-teal-600/50 bg-teal-50"
                      : "border-dotted border-muted-foreground/30 hover:border-muted-foreground/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="pdf-mode"
                    value={opt.key}
                    checked={exportPdfMode === opt.key}
                    onChange={() => setExportPdfMode(opt.key)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setExportPdfOpen(false)}>Annuler</Button>
              <Button
                className="flex-1 bg-teal-700 hover:bg-teal-800"
                onClick={async () => {
                  setExportPdfOpen(false);
                  const { exporterRapportBien } = await import("@/lib/rapportBien");
                  await exporterRapportBien({
                    bien,
                    lots,
                    depenses,
                    revenus,
                    pret,
                    interventions,
                    montantEmprunteEffectif,
                    breakEvenMarge,
                    mode: exportPdfMode,
                  });
                }}
              >
                Générer le PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation popup */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative border border-destructive/30 rounded-lg p-6 bg-background shadow-lg space-y-4 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-sm">Supprimer {bien.nom}</h3>
            <p className="text-sm text-muted-foreground">
              Toutes les donnees associees seront supprimees : depenses, revenus, credit, lots, interventions, contacts et documents.
            </p>
            <p className="text-sm text-muted-foreground">
              Tapez <strong className="text-foreground">{bien.nom}</strong> pour confirmer :
            </p>
            <Input
              autoFocus
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={bien.nom}
              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); if (e.key === "Escape") setDeleteOpen(false); }}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Annuler</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirmText !== bien.nom}
                onClick={handleDelete}
              >
                Supprimer definitivement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <BarreStatutBien
        statut={bien.statut ?? "exploitation"}
        statusDates={bien.statusDates}
        statusDocs={bien.statusDocs}
        onChange={(s: StatutBien) => {
          const today = new Date().toISOString().slice(0, 10);
          const prevDates = bien.statusDates ?? {};
          const nextDates = prevDates[s] ? prevDates : { ...prevDates, [s]: today };
          mettreAJourBien(id, { statut: s, statusDates: nextDates });
          // When the bien enters "travaux", automatically set every lot
          // to statut "travaux" — no rent is expected during renovation.
          if (s === "travaux") {
            for (const lot of lots) {
              if (lot.statut !== "travaux") mettreAJourLot(lot.id, { statut: "travaux" });
            }
          }
        }}
        onDateChange={(s, date) => {
          const prevDates = bien.statusDates ?? {};
          mettreAJourBien(id, { statusDates: { ...prevDates, [s]: date } });
          // Also sync lots when the user interacts with the travaux date —
          // covers the case where the status was already "travaux" and the
          // user is just setting / adjusting dates.
          if (s === "travaux" && bien.statut === "travaux") {
            for (const lot of lots) {
              if (lot.statut !== "travaux") mettreAJourLot(lot.id, { statut: "travaux" });
            }
          }
        }}
        onDocChange={(s, doc) => {
          const prevDocs = bien.statusDocs ?? {};
          if (doc) {
            mettreAJourBien(id, { statusDocs: { ...prevDocs, [s]: doc } });
          } else {
            const { [s]: _, ...rest } = prevDocs;
            mettreAJourBien(id, { statusDocs: rest });
          }
        }}
      />

      {/* KPIs */}
      <ResumeBien
        bien={bien}
        depenses={depenses}
        revenus={revenus}
        pret={pret}
        capitalUtiliseActuel={pret ? coutTotalBien(bien) - travauxNonTires : undefined}
        revenuMensuelTheorique={lots.reduce((s, l) => {
          const vac = bien.tauxVacanceGlobal != null ? bien.tauxVacanceGlobal : (l.tauxVacance ?? 0);
          return s + (l.loyerMensuel ?? 0) * (1 - vac);
        }, 0)}
        revenuMensuelMax={lots.reduce((s, l) => s + (l.loyerMensuel ?? 0), 0)}
        creditApresDiffereSurUtilise={
          pret && showEffectif
            ? mensualiteEffective + pret.assuranceAnnuelle / 12
            : undefined
        }
        lots={lots}
        suiviLoyers={suiviLoyers}
      />

      <Separator className="border-dashed" />

      {/* Credit */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2>Credit</h2>
            {isPreActe && pret && (
              <button
                onClick={() => setPretSafe({ ...pret, offerValidated: !creditValide })}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] transition-colors ${
                  creditValide
                    ? "bg-green-500/15 text-green-700 font-medium"
                    : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                }`}
              >
                {creditValide ? "✓ Offre validee" : "Offre a valider"}
              </button>
            )}
          </div>
          <FormulairePret bienId={id} initialData={pret ?? undefined} onSubmit={handleSetLoan} />
        </div>
        {pret ? (
          <Card className="border-dotted">
            <CardContent className="p-4">
              {pret.banque && (
                <p className="text-xs text-muted-foreground mb-3">🏦 {pret.banque}</p>
              )}
              {(() => {
                const assurMensuelle = pret.assuranceAnnuelle / 12;
                const dureeLabel = (() => {
                  if (dM <= 0) return `${pret.dureeAnnees} ans`;
                  if (pret.differeInclus === false) {
                    const t = pret.dureeAnnees * 12 + dM;
                    const a = Math.floor(t / 12);
                    const m = t % 12;
                    return `${a} ans${m > 0 ? ` ${m} mois` : ""}`;
                  }
                  return `${pret.dureeAnnees} ans`;
                })();
                const dureeDetail = dM > 0
                  ? pret.differeInclus === false
                    ? `${dM} mois de differe ${pret.differeType === "total" ? "total" : "partiel"} + ${pret.dureeAnnees} ans d'amortissement`
                    : `dont ${dM} mois de differe ${pret.differeType === "total" ? "total" : "partiel"}`
                  : null;

                return (
                  <>
                    {/* Row 1: core pret params */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Capital emprunte</p>
                        <p className="font-bold tabular-nums">{formatCurrency(pret.montantEmprunte)}</p>
                        {showEffectif && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Tire : <span className="tabular-nums font-medium text-foreground">{formatCurrency(montantEmprunteEffectif)}</span>
                            <span className="text-muted-foreground/60"> · {formatCurrency(travauxNonTires)} restant sur enveloppe travaux</span>
                          </p>
                        )}
                        {breakEvenMarge != null && (() => {
                          const marge = breakEvenMarge;
                          const restantEnveloppe = travauxNonTires;
                          if (marge <= 0) {
                            return (
                              <p className="text-[10px] mt-1 text-destructive">
                                CF Negatif · depassement de <span className="tabular-nums font-semibold">{formatCurrency(Math.abs(marge))}</span> au-dela du seuil
                              </p>
                            );
                          }
                          if (restantEnveloppe > 0 && marge >= restantEnveloppe) {
                            return (
                              <p className="text-[10px] mt-1 text-green-600">
                                Enveloppe restante consommable sans basculer en CF negatif · marge totale <span className="tabular-nums font-semibold">{formatCurrency(marge)}</span>
                              </p>
                            );
                          }
                          const ratioAmber = restantEnveloppe > 0 && marge / restantEnveloppe < 0.3;
                          return (
                            <p className={`text-[10px] mt-1 ${ratioAmber ? "text-amber-600" : "text-green-600"}`}>
                              Marge avant CF negatif : <span className="tabular-nums font-semibold">{formatCurrency(marge)}</span>
                              {restantEnveloppe > 0 && <span className="text-muted-foreground/60"> · sur {formatCurrency(restantEnveloppe)} restants</span>}
                            </p>
                          );
                        })()}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Taux nominal</p>
                        <p className={`font-bold tabular-nums ${priceClass(creditValide)}`}>{(pret.tauxAnnuel * 100).toFixed(2)} %</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Duree totale</p>
                        <p className={`font-bold ${priceClass(creditValide)}`}>{dureeLabel}</p>
                        {dureeDetail && (
                          <p className="text-[10px] text-muted-foreground mt-1">{dureeDetail}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: mensualites — breakdown capital / interet au survol */}
                    {(() => {
                      // Split capital / interet de la 1ere mensualite d'amortissement
                      // (representative du debut de la phase d'amortissement).
                      const crdStart = capitalApresDiffere(pret);
                      const interetM1 = crdStart * pret.tauxAnnuel / 12;
                      const capitalM1 = Math.max(0, mensualiteCredit - interetM1);
                      // Pendant le differe :
                      // - partiel : 100% interets (mensualiteDifferee = montantEmprunte × taux/12)
                      // - total   : 0 (interets capitalises)
                      const interetDiff = mensualiteDifferee;
                      const capitalDiff = 0;
                      const apresRows = [
                        { label: "Capital (1er mois)", value: `${formatCurrency(capitalM1, true)}` },
                        { label: "Interets (1er mois)", value: `${formatCurrency(interetM1, true)}`, color: "text-amber-600" },
                        ...(assurMensuelle > 0
                          ? [{ label: "Assurance", value: `${formatCurrency(assurMensuelle, true)}`, color: "text-amber-600" }]
                          : []),
                        { separator: true as const, label: "", value: "" },
                        { label: "Total", value: `${formatCurrency(mensualiteCredit + assurMensuelle, true)}/m`, bold: true },
                        { separator: true as const, label: "", value: "" },
                        { label: "La part capital augmente chaque mois", value: "" },
                      ];
                      const differeRows = [
                        { label: "Capital", value: `${formatCurrency(capitalDiff, true)}` },
                        { label: "Interets", value: `${formatCurrency(interetDiff, true)}`, color: "text-amber-600" },
                        ...(assurMensuelle > 0
                          ? [{ label: "Assurance", value: `${formatCurrency(assurMensuelle, true)}`, color: "text-amber-600" }]
                          : []),
                        { separator: true as const, label: "", value: "" },
                        { label: "Total", value: `${formatCurrency(mensualiteDifferee + assurMensuelle, true)}/m`, bold: true },
                        ...(pret.differeType === "total"
                          ? [
                              { separator: true as const, label: "", value: "" },
                              { label: "Interets capitalises au capital", value: "" },
                            ]
                          : []),
                      ];
                      return (
                        <div className={`flex items-start justify-center flex-wrap ${dM > 0 ? "gap-6 sm:gap-12" : ""} text-sm mt-4 pt-3 border-t border-dashed border-muted-foreground/10`}>
                          {/* Apres le differe (or single Mensualite) — primary */}
                          <CfTooltip rows={apresRows}>
                            <div className="text-center">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                {dM > 0 ? "Apres le differe" : "Mensualite"}
                              </p>
                              <p className={`text-lg font-bold tabular-nums ${priceClass(creditValide)}`}>
                                {formatCurrency(mensualiteCredit + assurMensuelle, true)}/m
                              </p>
                              {showEffectif && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Sur capital utilise : <span className="tabular-nums font-medium text-foreground">{formatCurrency(mensualiteEffective + assurMensuelle, true)}/m</span>
                                </p>
                              )}
                            </div>
                          </CfTooltip>
                          {/* Pendant le differe — secondary, dimmed */}
                          {dM > 0 && (
                            <CfTooltip rows={differeRows}>
                              <div className="text-center opacity-60 border-l border-dashed border-muted-foreground/20 pl-12">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                  Pendant le differe
                                  <span className="text-muted-foreground/60 normal-case ml-1">({dM}m)</span>
                                </p>
                                <p className={`font-bold tabular-nums ${priceClass(creditValide)}`}>
                                  {formatCurrency(mensualiteDifferee + assurMensuelle, true)}/m
                                </p>
                                {showEffectif && (
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    Sur capital utilise : <span className="tabular-nums font-medium text-foreground">{formatCurrency(mensualiteDifferEffective + assurMensuelle, true)}/m</span>
                                  </p>
                                )}
                              </div>
                            </CfTooltip>
                          )}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
              {/* Apport + warning financement */}
              <ApportSection
                bien={bien}
                pret={pret}
                onUpdateApport={(v) => mettreAJourBien(id, { apport: v })}
                onUpdateEmprunt={(v) => setPretSafe({ ...pret, montantEmprunte: v })}
              />
              {/* Allocation du financement */}
              <AllocationSection
                pret={pret}
                bien={bien}
                interventions={interventions}
                onSave={(alloc) => mettreAJourBien(id, { allocationCredit: alloc })}
                onUpdateLoan={(updates) => setPretSafe({ ...pret, ...updates })}
              />
              {/* Banque + Documents credit */}
              <LoanExtras pret={pret} onUpdate={(updates) => setPretSafe({ ...pret, ...updates })} />
              <button
                onClick={() => handleDeleteLoan(pret.id)}
                className="text-xs text-destructive hover:underline mt-3"
              >
                Supprimer le credit
              </button>
              <TableauAmortissementPret pret={pret} />
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun credit enregistre.</p>
        )}
      </section>

      <Separator className="border-dashed" />

      {/* Depenses */}
      <section>
        <Card className="border-dotted">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Depenses</CardTitle>
            <FormulaireDepense bienId={id} onSubmit={ajouterDepense} />
          </CardHeader>
          <CardContent>
            <ListeDepenses depenses={depenses} onDelete={supprimerDepense} onUpdate={mettreAJourDepense} colorByValidation={isPreActe} />
            <p className="text-[11px] text-amber-700 italic mt-3">
              ⚠ Donnees non utilisees dans les graphiques, seules les charges dans &quot;Loyer et charges&quot; le sont.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Lots */}
      <section>
        <SectionLots
          lots={lots}
          onAdd={handleAddLot}
          onUpdate={handleUpdateLot}
          onDelete={handleDeleteLot}
          bienId={id}
          propertyStatut={bien.statut}
          tauxVacanceGlobal={bien.tauxVacanceGlobal}
          onUpdateTauxVacanceGlobal={(v) => mettreAJourBien(id, { tauxVacanceGlobal: v })}
          onReviserLoyer={handleReviserLoyer}
        />
      </section>


      {/* Flux mensuels — only for post-acte biens */}
      {estPostActe(bien.statut) && (
        <section data-pdf-chart="fluxMensuels" data-pdf-chart-label="Flux mensuels depuis l'acquisition">
          <Card className="border-dotted">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Flux mensuels depuis l&apos;acquisition</CardTitle>
            </CardHeader>
            <CardContent>
              <GraphFluxMensuels bien={bien} revenus={revenus} depenses={depenses} suiviLoyers={suiviLoyers} pret={pret} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Cash flow annuel (Reel vs Simule) */}
      {bien.simulationId && (
        <section data-pdf-chart="cashFlowAnnuel" data-pdf-chart-label="Cash flow annuel">
          <SectionReelVsSimule
            bien={bien}
            revenus={revenus}
            depenses={depenses}
            suiviLoyers={suiviLoyers}
            pret={pret}
            onUpdateProperty={(updates) => mettreAJourBien(id, updates)}
            montantEmprunteConsomme={pret ? montantEmprunteEffectif : undefined}
            lots={lots}
            onActuelSnapshot={setActuelSnapshot}
          />
        </section>
      )}

      {/* Rendement mensuel */}
      <section data-pdf-chart="rendementMensuel" data-pdf-chart-label="Rendement mensuel">
        <Card className="border-dotted">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rendement mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <GraphRendementMensuel
              bien={bien}
              revenus={revenus}
              depenses={depenses}
              suiviLoyers={suiviLoyers}
              pret={pret}
              paiementsCharges={(data?.paiementsCharges ?? []).filter((c) => c.bienId === id)}
            />
          </CardContent>
        </Card>
      </section>

      <Separator className="border-dashed" />

      {/* Travaux */}
      <section>
        <SectionInterventions
          interventions={interventions}
          onAdd={ajouterIntervention}
          onUpdate={handleUpdateIntervention}
          onDelete={supprimerIntervention}
          bienId={id}
          filterType="travaux"
          lots={lots}
          enveloppeCredit={pret ? calculerAllocationCredit(bien, pret).travaux : 0}
          enveloppeOuverte={pret ? estEnveloppeTravauxOuverte(pret) : true}
        />
      </section>

      {/* Interventions */}
      <section>
        <SectionInterventions interventions={interventions} onAdd={ajouterIntervention} onUpdate={handleUpdateIntervention} onDelete={supprimerIntervention} bienId={id} filterType="intervention" lots={lots} />
      </section>

      {/* Contacts */}
      <section>
        <SectionContacts contacts={contacts} onAdd={ajouterContact} onUpdate={mettreAJourContact} onDelete={supprimerContact} bienId={id} />
      </section>

      {/* Documents */}
      <section>
        <SectionDocuments
          documents={documents}
          onAdd={ajouterDocument}
          onDelete={handleDeleteDocument}
          bienId={id}
          linkedDocs={(() => {
            const ld: import("@/components/bien/SectionDocuments").LinkedDoc[] = [];
            // Timeline phase docs (statusDocs)
            if (bien.statusDocs) {
              for (const [phase, doc] of Object.entries(bien.statusDocs)) {
                if (!doc || !doc.data) continue;
                ld.push({
                  key: `phase:${phase}`,
                  sourceLabel: `Phase ${STATUT_BIEN_LABELS[phase as keyof typeof STATUT_BIEN_LABELS] ?? phase}`,
                  fileName: doc.nom,
                  fileSize: doc.taille,
                  date: bien.statusDates?.[phase as keyof typeof bien.statusDates] ?? "",
                  dataUri: doc.data,
                });
              }
            }
            // Loan docs
            if (pret?.documents) {
              for (let i = 0; i < pret.documents.length; i++) {
                const doc = pret.documents[i];
                if (!doc.data) continue;
                ld.push({
                  key: `pret:${i}`,
                  sourceLabel: "Credit",
                  fileName: doc.nom,
                  fileSize: doc.taille,
                  date: doc.ajouteLe ?? pret.dateDebut,
                  dataUri: doc.data,
                });
              }
            }
            // Intervention PJs
            for (const inter of interventions) {
              if (!inter.pieceJointe?.data) continue;
              ld.push({
                key: `inter:${inter.id}`,
                sourceLabel: inter.interventionType === "travaux" ? "Travaux" : "Intervention",
                fileName: inter.pieceJointe.nom,
                fileSize: inter.pieceJointe.taille,
                date: inter.date,
                dataUri: inter.pieceJointe.data,
              });
            }
            return ld;
          })()}
        />
      </section>

    </div>
  );
}

export default function PropertyDetailPage() {
  return (
    <Suspense fallback={null}>
      <PropertyDetailContent />
    </Suspense>
  );
}
