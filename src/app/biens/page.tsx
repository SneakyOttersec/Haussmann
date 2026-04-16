"use client";

import { Suspense, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppData } from "@/hooks/useLocalStorage";
import { useProperties } from "@/hooks/useProperties";
import { useExpenses } from "@/hooks/useExpenses";
import { useIncomes } from "@/hooks/useIncomes";
import { useLoans } from "@/hooks/useLoans";
import { useInterventions } from "@/hooks/useInterventions";
import { useContacts } from "@/hooks/useContacts";
import { useDocuments } from "@/hooks/useDocuments";
import { useLots } from "@/hooks/useLots";
import { TYPE_BIEN_LABELS } from "@/types";
import type { StatutBien, Bien, Pret, AllocationCredit, Intervention } from "@/types";
import { STATUT_BIEN_ORDER, STATUT_BIEN_LABELS } from "@/types";
import { formatCurrency, checkFileSize, coutTotalBien, enveloppeTravauxFinDate, isEnveloppeTravauxOuverte } from "@/lib/utils";
import { calculerMensualite } from "@/lib/calculations";
import { mensualiteAmortissement, mensualitePendantDiffere, capitalApresDiffere } from "@/lib/calculations/loan";
import { CfTooltip } from "@/components/ui/cf-tooltip";
import { PropertySummary } from "@/components/property/PropertySummary";
import { PropertyStatusBar } from "@/components/property/PropertyStatusBar";
import { ExpenseList } from "@/components/property/ExpenseList";
import { ExpenseForm } from "@/components/property/ExpenseForm";
import { IncomeList } from "@/components/property/IncomeList";
import { IncomeForm } from "@/components/property/IncomeForm";
import { LoanForm } from "@/components/property/LoanForm";
import { LoanAmortizationTable } from "@/components/property/LoanAmortizationTable";
import dynamic from "next/dynamic";
import { useRentTracking } from "@/hooks/useRentTracking";

// recharts (~8.5 MB) is only used by these two — lazy-load to keep /biens cold-load light.
const CashFlowChart = dynamic(
  () => import("@/components/property/CashFlowChart").then((m) => m.CashFlowChart),
  { ssr: false, loading: () => <div className="h-[300px] border border-dashed rounded-md" /> }
);
const RealVsSimulatedSection = dynamic(
  () => import("@/components/property/RealVsSimulatedSection").then((m) => m.RealVsSimulatedSection),
  { ssr: false, loading: () => <div className="h-[495px] border border-dashed rounded-md" /> }
);
const MonthlyRendementChart = dynamic(
  () => import("@/components/property/MonthlyRendementChart").then((m) => m.MonthlyRendementChart),
  { ssr: false, loading: () => <div className="h-[300px] border border-dashed rounded-md" /> }
);

// Below-the-fold sections — lazy-load to shrink /biens initial bundle.
// Each section is large (forms, tables, dialogs) and only relevant when the user scrolls to it.
const LotSection = dynamic(
  () => import("@/components/property/LotSection").then((m) => m.LotSection),
  { ssr: false, loading: () => <div className="h-[200px] border border-dashed rounded-md" /> }
);
const InterventionSection = dynamic(
  () => import("@/components/property/InterventionSection").then((m) => m.InterventionSection),
  { ssr: false, loading: () => <div className="h-[200px] border border-dashed rounded-md" /> }
);
const ContactSection = dynamic(
  () => import("@/components/property/ContactSection").then((m) => m.ContactSection),
  { ssr: false, loading: () => <div className="h-[200px] border border-dashed rounded-md" /> }
);
const DocumentSection = dynamic(
  () => import("@/components/property/DocumentSection").then((m) => m.DocumentSection),
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

function LoanExtras({ loan, onUpdate }: {
  loan: Pret;
  onUpdate: (updates: Partial<Pret>) => void;
}) {
  const [editBanque, setEditBanque] = useState(false);
  const [banqueDraft, setBanqueDraft] = useState(loan.banque || "");
  const fileRef = useRef<HTMLInputElement>(null);
  const docs = loan.documents ?? [];

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
            onClick={() => { setBanqueDraft(loan.banque || ""); setEditBanque(true); }}
            title="Cliquer pour modifier"
            className="inline-flex items-center gap-1.5 text-sm px-2 py-0.5 rounded border border-dashed border-muted-foreground/40 hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-colors"
          >
            {loan.banque ? (
              <>
                <span>{loan.banque}</span>
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
 * Compute the credit allocation for a property + loan. Uses the stored
 * allocationCredit when available; otherwise derives a default that
 * covers the full project cost (credit + apport). Shared by
 * AllocationSection (display) and the InterventionSection call site
 * (enveloppe travaux).
 */
function computeAllocationCredit(property: Bien, loan: Pret): AllocationCredit {
  // Backfill dossier/garantie/mobilier on older allocations that predate those buckets.
  if (property.allocationCredit) {
    const a = property.allocationCredit as Partial<AllocationCredit> & Omit<AllocationCredit, "dossier" | "garantie" | "mobilier">;
    // Mobilier absent de l'allocation mais present sur la propriete : on le
    // backfill automatiquement pour que le cout total soit coherent.
    const mobilier = a.mobilier ?? property.montantMobilier ?? 0;
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
    bien: property.prixAchat,
    travaux: property.montantTravaux,
    notaire: property.fraisNotaire,
    agence: property.fraisAgence,
    dossier: property.fraisDossier ?? 0,
    garantie: 0,
    mobilier: property.montantMobilier ?? 0,
    autre: property.fraisCourtage ?? 0,
  };
}

function ApportSection({ property, loan, onUpdateApport, onUpdateEmprunt }: {
  property: Bien;
  loan: Pret;
  onUpdateApport: (v: number | undefined) => void;
  onUpdateEmprunt: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const coutTotal = coutTotalBien(property);
  const apportDerive = Math.max(0, coutTotal - loan.montantEmprunte);
  const apport = property.apport ?? apportDerive;
  const [draft, setDraft] = useState(String(apport));
  const isCustom = property.apport != null;
  const totalFinance = loan.montantEmprunte + apport;
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
        <span className="font-medium tabular-nums">{formatCurrency(loan.montantEmprunte)}</span>
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

function AllocationSection({ loan, property, interventions, onSave, onUpdateLoan }: {
  loan: Pret;
  property: Bien;
  interventions: Intervention[];
  onSave: (alloc: AllocationCredit) => void;
  onUpdateLoan: (updates: Partial<Pret>) => void;
}) {
  const defaultAlloc = computeAllocationCredit(property, loan);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState(defaultAlloc);

  // Travaux funded by the loan envelope — drives the small "x € sur y € utilises" hint
  // displayed right under the Travaux row.
  const travauxFinances = interventions
    .filter((i) => (i.interventionType ?? "intervention") === "travaux" && i.financeParCredit)
    .reduce((s, i) => s + i.montant, 0);
  const travauxEnveloppe = defaultAlloc.travaux;
  const travauxPct = travauxEnveloppe > 0 ? Math.round((travauxFinances / travauxEnveloppe) * 100) : 0;
  const travauxOverflow = travauxFinances > travauxEnveloppe;

  // Note: this list is rendered manually so we can interleave the travaux usage hint.
  const enveloppeFinDate = enveloppeTravauxFinDate(loan);
  const enveloppeOuverte = isEnveloppeTravauxOuverte(loan);

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
  const apport = property.apport ?? 0;
  const financementTotal = loan.montantEmprunte + apport;
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
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Allocation du credit</p>
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
                      ↳ dispo jusqu&apos;au{" "}
                      <input
                        type="date"
                        value={enveloppeFinDate ?? ""}
                        onChange={(e) => onUpdateLoan({ enveloppeTravauxFinDate: e.target.value || undefined })}
                        className="h-5 px-1 text-[10px] border border-dashed border-muted-foreground/30 rounded bg-transparent focus:border-primary outline-none tabular-nums"
                      />
                      {!enveloppeOuverte && (
                        <span className="text-destructive font-medium">expiree</span>
                      )}
                      {enveloppeOuverte && enveloppeFinDate && (
                        <span className="text-green-600">ouverte</span>
                      )}
                      {loan.enveloppeTravauxFinDate && (
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
            ↳ credit {formatCurrency(loan.montantEmprunte)} + apport {formatCurrency(apport)}
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
          <DialogHeader><DialogTitle>Allocation du credit</DialogTitle></DialogHeader>
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
                credit {formatCurrency(loan.montantEmprunte)} + apport {formatCurrency(apport)}
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
function isPostActe(statut?: StatutBien): boolean {
  if (!statut) return true; // backward compat
  const idx = STATUT_BIEN_ORDER.indexOf(statut);
  const acteIdx = STATUT_BIEN_ORDER.indexOf("acte");
  return idx >= acteIdx;
}

function PropertyDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { data, setData } = useAppData();
  const router = useRouter();
  const { getProperty, updateProperty, deleteProperty } = useProperties(data, setData);
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses(data, setData, id ?? undefined);
  const { incomes, addIncome, updateIncome, deleteIncome } = useIncomes(data, setData, id ?? undefined);
  const { loan, setLoan, deleteLoan } = useLoans(data, setData, id ?? undefined);
  const { interventions, addIntervention, updateIntervention, deleteIntervention } = useInterventions(data, setData, id ?? undefined);
  const { contacts, addContact, updateContact, deleteContact } = useContacts(data, setData, id ?? undefined);
  const { documents, addDocument, deleteDocument } = useDocuments(data, setData, id ?? undefined);
  const { lots, addLot, updateLot, deleteLot } = useLots(data, setData, id ?? undefined);
  const { entries: rentEntries } = useRentTracking(data, setData, id ?? undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // Tracks whether we've already auto-synced lots for the current "travaux" session.
  // Reset when the property leaves "travaux", so re-entering triggers a new sync.
  const travauxSyncedRef = useRef(false);
  // Snapshot "Projection actuelle" A1 remonte par RealVsSimulatedSection —
  // source de verite partagee avec le graph pour la marge travaux / CF negatif.
  // Place ici (avant l'early return) pour respecter les rules of hooks.
  const [actuelSnapshot, setActuelSnapshot] = useState<{ loyerNetAnnuel: number; chargesAnnuelles: number } | null>(null);
  const [exportPdfOpen, setExportPdfOpen] = useState(false);
  const [exportPdfMode, setExportPdfMode] = useState<"demande_pret" | "suivi_interne" | "refinancement">("demande_pret");

  if (!data || !id) return null;

  const property = getProperty(id);
  if (!property) {
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
  // Runs once per "travaux session": syncs desynced lots when the property
  // enters travaux (or when the page loads with property already in travaux).
  // After the one-time sync, user overrides via the force-confirmation dialog
  // are respected — no re-sync until the property leaves then re-enters travaux.
  if (property.statut === "travaux") {
    if (!travauxSyncedRef.current) {
      const desyncedLots = lots.filter((l) => l.statut !== "travaux");
      if (desyncedLots.length > 0) {
        queueMicrotask(() => {
          for (const lot of desyncedLots) {
            updateLot(lot.id, { statut: "travaux" });
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
  // For pre-acte loans with a defer, this is what the user will pay starting
  // month N+1 — it's the most informative number for the validation tickbox.
  const mensualiteCredit = loan ? mensualiteAmortissement(loan) : 0;
  const dM = loan?.differeMois ?? 0;
  const mensualiteDifferee = loan && dM > 0 ? mensualitePendantDiffere(loan) : 0;

  // ── Travaux envelope consumption → effective principal & monthly payment ──
  //
  // Real-life French banks release the travaux envelope progressively as the
  // borrower presents invoices. The effective amount drawn at any point in time
  // equals the loan total minus the unspent portion of the travaux envelope.
  // We recompute the mensualite on this effective principal so the user sees
  // what they actually pay today vs. what they'll pay once the envelope is
  // fully consumed.
  const travauxEnveloppeCredit = property.allocationCredit?.travaux ?? 0;
  const travauxFinancesParCredit = interventions
    .filter((i) => (i.interventionType ?? "intervention") === "travaux" && i.financeParCredit)
    .reduce((s, i) => s + i.montant, 0);
  const travauxNonTires = loan
    ? Math.max(0, travauxEnveloppeCredit - travauxFinancesParCredit)
    : 0;
  const montantEmprunteEffectif = loan ? Math.max(0, loan.montantEmprunte - travauxNonTires) : 0;
  // Synthetic loan with the effective principal — drives both the mensualite
  // amortization phase and the differe-period interest payment.
  const loanEffectif = loan ? { ...loan, montantEmprunte: montantEmprunteEffectif } : null;
  const mensualiteEffective = loanEffectif ? mensualiteAmortissement(loanEffectif) : 0;
  const mensualiteDifferEffective = loanEffectif && dM > 0 ? mensualitePendantDiffere(loanEffectif) : 0;
  const showEffectif = loan != null && travauxNonTires > 0;

  // ── Marge travaux avant CF negatif ──
  // Principal P* qui fait basculer le CF annuel a 0 en regime post-differe :
  //   CF(P) = loyerNet − charges − assurance_annuelle − P × kEff × 12
  //   P* = (loyerNet − charges − assurance_annuelle) / (kEff × 12)
  //   marge = P* − montantEmprunteEffectif
  // kEff vient de `mensualiteAmortissement(loanEffectif) / montantEmprunteEffectif`
  // — gere correctement differeInclus + differe partiel/total (capitalisation).
  const breakEvenMarge: number | null = (() => {
    if (!loan || !loanEffectif || !actuelSnapshot) return null;
    if (montantEmprunteEffectif <= 0 || mensualiteEffective <= 0) return null;
    const { loyerNetAnnuel, chargesAnnuelles } = actuelSnapshot;
    const disponibleAvantCredit = loyerNetAnnuel - chargesAnnuelles - loan.assuranceAnnuelle;
    const kEff = mensualiteEffective / montantEmprunteEffectif;
    if (kEff <= 0) return null;
    const pStar = disponibleAvantCredit / (kEff * 12);
    return pStar - montantEmprunteEffectif;
  })();

  // Pre-acte = the property is still being prospected/negotiated. While in this
  // state, financial values are projections — we color each price green when the
  // user has validated it against a real contract/offer, orange otherwise. Once
  // the property is post-acte, prices are real and stay in the default colour.
  const isPreActe = !isPostActe(property.statut);
  const creditValide = !!loan?.offerValidated;
  const priceClass = (validated: boolean): string =>
    isPreActe ? (validated ? "text-green-600" : "text-amber-600") : "";

  const handleSetLoan = (loanData: Parameters<typeof setLoan>[0]) => {
    setLoan(loanData);
    // The auto-created "credit" expense holds the post-defer monthly payment.
    // The Cash Flow chart and fiscal bilan compute the real per-month cost
    // from the loan helpers, so they correctly handle the defer phase.
    const mensualite = mensualiteAmortissement(loanData);
    const assuranceMensuelle = loanData.assuranceAnnuelle / 12;
    const montantTotal = Math.round((mensualite + assuranceMensuelle) * 100) / 100;
    const creditExpense = expenses.find((e) => e.categorie === "credit");
    if (creditExpense) {
      updateExpense(creditExpense.id, { montant: montantTotal, dateDebut: loanData.dateDebut });
    } else {
      addExpense({
        propertyId: id,
        categorie: "credit",
        label: "Mensualite credit",
        montant: montantTotal,
        frequence: "mensuel",
        dateDebut: loanData.dateDebut,
        notes: "",
      });
    }
  };

  const handleDeleteLoan = (loanId: string) => {
    deleteLoan(loanId);
    const creditExpense = expenses.find((e) => e.categorie === "credit");
    if (creditExpense) {
      deleteExpense(creditExpense.id);
    }
  };

  // Lot → Revenu sync: each lot creates/updates a matching income entry
  const handleAddLot = (lotData: Parameters<typeof addLot>[0]) => {
    addLot(lotData);
    addIncome({
      propertyId: id,
      categorie: "loyer",
      label: lotData.nom || "Loyer",
      montant: lotData.loyerMensuel,
      frequence: "mensuel",
      dateDebut: new Date().toISOString().slice(0, 10),
      notes: `Lot: ${lotData.nom}`,
    });
  };

  const handleUpdateLot = (lotId: string, updates: Parameters<typeof updateLot>[1]) => {
    updateLot(lotId, updates);
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) return;
    const matchingIncome = incomes.find((i) => i.notes === `Lot: ${lot.nom}` && i.categorie === "loyer");
    if (matchingIncome) {
      const incUpdates: Record<string, unknown> = {};
      if (updates.loyerMensuel !== undefined) incUpdates.montant = updates.loyerMensuel;
      if (updates.nom !== undefined) {
        incUpdates.label = updates.nom;
        incUpdates.notes = `Lot: ${updates.nom}`;
      }
      if (Object.keys(incUpdates).length > 0) updateIncome(matchingIncome.id, incUpdates);
    }
  };

  const handleDeleteLot = (lotId: string) => {
    const lot = lots.find((l) => l.id === lotId);
    deleteLot(lotId);
    if (lot) {
      const matchingIncome = incomes.find((i) => i.notes === `Lot: ${lot.nom}` && i.categorie === "loyer");
      if (matchingIncome) deleteIncome(matchingIncome.id);
    }
  };

  // Intervention → Document sync: when a PJ is attached, mirror it in Documents
  const handleUpdateIntervention = (intId: string, updates: Parameters<typeof updateIntervention>[1]) => {
    updateIntervention(intId, updates);
    if (updates.pieceJointe) {
      const intervention = interventions.find((i) => i.id === intId);
      const label = intervention?.description ?? "Intervention";
      const typeLabel = (intervention?.interventionType ?? "intervention") === "travaux" ? "Travaux" : "Intervention";
      // Remove old linked doc if replacing
      const oldDoc = documents.find((d) => d.linkedInterventionId === intId);
      if (oldDoc) deleteDocument(oldDoc.id);
      // Add new linked doc
      addDocument({
        propertyId: id,
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
      if (linkedDoc) deleteDocument(linkedDoc.id);
    }
  };

  const handleDeleteDocument = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (doc?.linkedInterventionId) {
      updateIntervention(doc.linkedInterventionId, { pieceJointe: undefined });
    }
    deleteDocument(docId);
  };

  const handleDelete = () => {
    if (deleteConfirmText === property.nom) {
      deleteProperty(id);
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
              <h1 className="break-words">{property.nom}</h1>
              <Badge variant="secondary">{TYPE_BIEN_LABELS[property.type]}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 break-words">{property.adresse}</p>
            <p className="text-sm text-muted-foreground">
              Achat : {formatCurrency(property.prixAchat)} — {property.dateSaisie}
              {property.surfaceM2 ? ` — ${property.surfaceM2} m²` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap md:justify-end">
            {/* Navigation : vues rattachees au bien */}
            <Link
              href={`/loyers?propertyId=${id}`}
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
            {property.simulationId && (
              <Link
                href={`/simulateur?simId=${property.simulationId}`}
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
                  const { exportPropertyReport } = await import("@/lib/propertyReport");
                  await exportPropertyReport({
                    property,
                    lots,
                    expenses,
                    incomes,
                    loan,
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
            <h3 className="font-bold text-sm">Supprimer {property.nom}</h3>
            <p className="text-sm text-muted-foreground">
              Toutes les donnees associees seront supprimees : depenses, revenus, credit, lots, interventions, contacts et documents.
            </p>
            <p className="text-sm text-muted-foreground">
              Tapez <strong className="text-foreground">{property.nom}</strong> pour confirmer :
            </p>
            <Input
              autoFocus
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={property.nom}
              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); if (e.key === "Escape") setDeleteOpen(false); }}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Annuler</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteConfirmText !== property.nom}
                onClick={handleDelete}
              >
                Supprimer definitivement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <PropertyStatusBar
        statut={property.statut ?? "exploitation"}
        statusDates={property.statusDates}
        statusDocs={property.statusDocs}
        onChange={(s: StatutBien) => {
          const today = new Date().toISOString().slice(0, 10);
          const prevDates = property.statusDates ?? {};
          const nextDates = prevDates[s] ? prevDates : { ...prevDates, [s]: today };
          updateProperty(id, { statut: s, statusDates: nextDates });
          // When the property enters "travaux", automatically set every lot
          // to statut "travaux" — no rent is expected during renovation.
          if (s === "travaux") {
            for (const lot of lots) {
              if (lot.statut !== "travaux") updateLot(lot.id, { statut: "travaux" });
            }
          }
        }}
        onDateChange={(s, date) => {
          const prevDates = property.statusDates ?? {};
          updateProperty(id, { statusDates: { ...prevDates, [s]: date } });
          // Also sync lots when the user interacts with the travaux date —
          // covers the case where the status was already "travaux" and the
          // user is just setting / adjusting dates.
          if (s === "travaux" && property.statut === "travaux") {
            for (const lot of lots) {
              if (lot.statut !== "travaux") updateLot(lot.id, { statut: "travaux" });
            }
          }
        }}
        onDocChange={(s, doc) => {
          const prevDocs = property.statusDocs ?? {};
          if (doc) {
            updateProperty(id, { statusDocs: { ...prevDocs, [s]: doc } });
          } else {
            const { [s]: _, ...rest } = prevDocs;
            updateProperty(id, { statusDocs: rest });
          }
        }}
      />

      {/* KPIs */}
      <PropertySummary
        property={property}
        expenses={expenses}
        incomes={incomes}
        loan={loan}
        capitalUtiliseActuel={loan ? coutTotalBien(property) - travauxNonTires : undefined}
        revenuMensuelTheorique={lots.reduce((s, l) => {
          const vac = property.tauxVacanceGlobal != null ? property.tauxVacanceGlobal : (l.tauxVacance ?? 0);
          return s + (l.loyerMensuel ?? 0) * (1 - vac);
        }, 0)}
        revenuMensuelMax={lots.reduce((s, l) => s + (l.loyerMensuel ?? 0), 0)}
        creditApresDiffereSurUtilise={
          loan && showEffectif
            ? mensualiteEffective + loan.assuranceAnnuelle / 12
            : undefined
        }
        lots={lots}
        rentEntries={rentEntries}
      />

      <Separator className="border-dashed" />

      {/* Credit */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2>Credit</h2>
            {isPreActe && loan && (
              <button
                onClick={() => setLoan({ ...loan, offerValidated: !creditValide })}
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
          <LoanForm propertyId={id} initialData={loan ?? undefined} onSubmit={handleSetLoan} />
        </div>
        {loan ? (
          <Card className="border-dotted">
            <CardContent className="p-4">
              {loan.banque && (
                <p className="text-xs text-muted-foreground mb-3">🏦 {loan.banque}</p>
              )}
              {(() => {
                const assurMensuelle = loan.assuranceAnnuelle / 12;
                const dureeLabel = (() => {
                  if (dM <= 0) return `${loan.dureeAnnees} ans`;
                  if (loan.differeInclus === false) {
                    const t = loan.dureeAnnees * 12 + dM;
                    const a = Math.floor(t / 12);
                    const m = t % 12;
                    return `${a} ans${m > 0 ? ` ${m} mois` : ""}`;
                  }
                  return `${loan.dureeAnnees} ans`;
                })();
                const dureeDetail = dM > 0
                  ? loan.differeInclus === false
                    ? `${dM} mois de differe ${loan.differeType === "total" ? "total" : "partiel"} + ${loan.dureeAnnees} ans d'amortissement`
                    : `dont ${dM} mois de differe ${loan.differeType === "total" ? "total" : "partiel"}`
                  : null;

                return (
                  <>
                    {/* Row 1: core loan params */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Capital emprunte</p>
                        <p className="font-bold tabular-nums">{formatCurrency(loan.montantEmprunte)}</p>
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
                        <p className={`font-bold tabular-nums ${priceClass(creditValide)}`}>{(loan.tauxAnnuel * 100).toFixed(2)} %</p>
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
                      const crdStart = capitalApresDiffere(loan);
                      const interetM1 = crdStart * loan.tauxAnnuel / 12;
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
                        ...(loan.differeType === "total"
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
                property={property}
                loan={loan}
                onUpdateApport={(v) => updateProperty(id, { apport: v })}
                onUpdateEmprunt={(v) => setLoan({ ...loan, montantEmprunte: v })}
              />
              {/* Allocation du credit */}
              <AllocationSection
                loan={loan}
                property={property}
                interventions={interventions}
                onSave={(alloc) => updateProperty(id, { allocationCredit: alloc })}
                onUpdateLoan={(updates) => setLoan({ ...loan, ...updates })}
              />
              {/* Banque + Documents credit */}
              <LoanExtras loan={loan} onUpdate={(updates) => setLoan({ ...loan, ...updates })} />
              <button
                onClick={() => handleDeleteLoan(loan.id)}
                className="text-xs text-destructive hover:underline mt-3"
              >
                Supprimer le credit
              </button>
              <LoanAmortizationTable loan={loan} />
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
            <ExpenseForm propertyId={id} onSubmit={addExpense} />
          </CardHeader>
          <CardContent>
            <ExpenseList expenses={expenses} onDelete={deleteExpense} onUpdate={updateExpense} colorByValidation={isPreActe} />
            <p className="text-[11px] text-amber-700 italic mt-3">
              ⚠ Donnees non utilisees dans les graphiques, seules les charges dans &quot;Loyer et charges&quot; le sont.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Lots */}
      <section>
        <LotSection
          lots={lots}
          onAdd={handleAddLot}
          onUpdate={handleUpdateLot}
          onDelete={handleDeleteLot}
          propertyId={id}
          propertyStatut={property.statut}
          tauxVacanceGlobal={property.tauxVacanceGlobal}
          onUpdateTauxVacanceGlobal={(v) => updateProperty(id, { tauxVacanceGlobal: v })}
        />
      </section>


      {/* Flux mensuels — only for post-acte properties */}
      {isPostActe(property.statut) && (
        <section data-pdf-chart="fluxMensuels" data-pdf-chart-label="Flux mensuels depuis l'acquisition">
          <Card className="border-dotted">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Flux mensuels depuis l&apos;acquisition</CardTitle>
            </CardHeader>
            <CardContent>
              <CashFlowChart property={property} incomes={incomes} expenses={expenses} rentEntries={rentEntries} loan={loan} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Cash flow annuel (Reel vs Simule) */}
      {property.simulationId && (
        <section data-pdf-chart="cashFlowAnnuel" data-pdf-chart-label="Cash flow annuel">
          <RealVsSimulatedSection
            property={property}
            incomes={incomes}
            expenses={expenses}
            rentEntries={rentEntries}
            loan={loan}
            onUpdateProperty={(updates) => updateProperty(id, updates)}
            montantEmprunteConsomme={loan ? montantEmprunteEffectif : undefined}
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
            <MonthlyRendementChart
              property={property}
              incomes={incomes}
              expenses={expenses}
              rentEntries={rentEntries}
              loan={loan}
              chargePayments={(data?.chargePayments ?? []).filter((c) => c.propertyId === id)}
            />
          </CardContent>
        </Card>
      </section>

      <Separator className="border-dashed" />

      {/* Travaux */}
      <section>
        <InterventionSection
          interventions={interventions}
          onAdd={addIntervention}
          onUpdate={handleUpdateIntervention}
          onDelete={deleteIntervention}
          propertyId={id}
          filterType="travaux"
          lots={lots}
          enveloppeCredit={loan ? computeAllocationCredit(property, loan).travaux : 0}
          enveloppeOuverte={loan ? isEnveloppeTravauxOuverte(loan) : true}
        />
      </section>

      {/* Interventions */}
      <section>
        <InterventionSection interventions={interventions} onAdd={addIntervention} onUpdate={handleUpdateIntervention} onDelete={deleteIntervention} propertyId={id} filterType="intervention" lots={lots} />
      </section>

      {/* Contacts */}
      <section>
        <ContactSection contacts={contacts} onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact} propertyId={id} />
      </section>

      {/* Documents */}
      <section>
        <DocumentSection
          documents={documents}
          onAdd={addDocument}
          onDelete={handleDeleteDocument}
          propertyId={id}
          linkedDocs={(() => {
            const ld: import("@/components/property/DocumentSection").LinkedDoc[] = [];
            // Timeline phase docs (statusDocs)
            if (property.statusDocs) {
              for (const [phase, doc] of Object.entries(property.statusDocs)) {
                if (!doc || !doc.data) continue;
                ld.push({
                  key: `phase:${phase}`,
                  sourceLabel: `Phase ${STATUT_BIEN_LABELS[phase as keyof typeof STATUT_BIEN_LABELS] ?? phase}`,
                  fileName: doc.nom,
                  fileSize: doc.taille,
                  date: property.statusDates?.[phase as keyof typeof property.statusDates] ?? "",
                  dataUri: doc.data,
                });
              }
            }
            // Loan docs
            if (loan?.documents) {
              for (let i = 0; i < loan.documents.length; i++) {
                const doc = loan.documents[i];
                if (!doc.data) continue;
                ld.push({
                  key: `loan:${i}`,
                  sourceLabel: "Credit",
                  fileName: doc.nom,
                  fileSize: doc.taille,
                  date: doc.ajouteLe ?? loan.dateDebut,
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
