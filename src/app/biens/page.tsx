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
import { PROPERTY_TYPE_LABELS } from "@/types";
import type { PropertyStatus, Property, LoanDetails, AllocationCredit } from "@/types";
import { PROPERTY_STATUS_ORDER } from "@/types";
import { formatCurrency, checkFileSize } from "@/lib/utils";
import { calculerMensualite } from "@/lib/calculations";
import { PropertySummary } from "@/components/property/PropertySummary";
import { PropertyStatusBar } from "@/components/property/PropertyStatusBar";
import { ExpenseList } from "@/components/property/ExpenseList";
import { ExpenseForm } from "@/components/property/ExpenseForm";
import { IncomeList } from "@/components/property/IncomeList";
import { IncomeForm } from "@/components/property/IncomeForm";
import { LoanForm } from "@/components/property/LoanForm";
import { LoanAmortizationTable } from "@/components/property/LoanAmortizationTable";
import { CashFlowChart } from "@/components/property/CashFlowChart";
import { InterventionSection } from "@/components/property/InterventionSection";
import { ContactSection } from "@/components/property/ContactSection";
import { DocumentSection } from "@/components/property/DocumentSection";
import { LotSection } from "@/components/property/LotSection";
import { useRentTracking } from "@/hooks/useRentTracking";
import { RealVsSimulatedSection } from "@/components/property/RealVsSimulatedSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { LoanPJ } from "@/types";

function LoanExtras({ loan, onUpdate }: {
  loan: LoanDetails;
  onUpdate: (updates: Partial<LoanDetails>) => void;
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
      const newDoc: LoanPJ = {
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

  const downloadDoc = (doc: LoanPJ) => {
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
            className="h-6 px-2 text-sm border border-input rounded bg-transparent outline-none focus:border-ring flex-1"
            placeholder="Nom de la banque"
          />
        ) : (
          <button
            onClick={() => { setBanqueDraft(loan.banque || ""); setEditBanque(true); }}
            className="text-sm hover:text-primary transition-colors"
          >
            {loan.banque || <span className="text-muted-foreground text-xs">+ Definir</span>}
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

function AllocationSection({ loan, property, onSave }: {
  loan: LoanDetails;
  property: Property;
  onSave: (alloc: AllocationCredit) => void;
}) {
  const defaultAlloc: AllocationCredit = property.allocationCredit ?? {
    bien: property.prixAchat,
    travaux: property.montantTravaux,
    notaire: property.fraisNotaire,
    agence: 0,
    autre: 0,
  };
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState(defaultAlloc);

  const allocations = [
    { label: "Bien immobilier", value: defaultAlloc.bien },
    { label: "Travaux", value: defaultAlloc.travaux },
    { label: "Frais de notaire", value: defaultAlloc.notaire },
    { label: "Frais d'agence", value: defaultAlloc.agence },
    { label: "Autre", value: defaultAlloc.autre },
  ];
  const totalAlloue = allocations.reduce((s, a) => s + a.value, 0);
  const ecart = loan.montantEmprunte - totalAlloue;

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
          {allocations.filter(a => a.value > 0).map((a) => (
            <div key={a.label} className="flex justify-between">
              <span className="text-muted-foreground">{a.label}</span>
              <span className="font-medium tabular-nums">{formatCurrency(a.value)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1 border-t border-dashed border-muted-foreground/10 font-bold">
            <span>Total emprunte</span>
            <span className="tabular-nums">{formatCurrency(loan.montantEmprunte)}</span>
          </div>
          {ecart !== 0 && (
            <p className="text-xs text-destructive">Ecart : {formatCurrency(ecart)}</p>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Allocation du credit</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {([
              { key: "bien", label: "Bien immobilier" },
              { key: "travaux", label: "Travaux" },
              { key: "notaire", label: "Frais de notaire" },
              { key: "agence", label: "Frais d'agence" },
              { key: "autre", label: "Autre" },
            ] as const).map((field) => (
              <div key={field.key} className="flex items-center gap-4">
                <Label className="text-sm text-muted-foreground w-40 shrink-0">{field.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={edit[field.key] || ""}
                  onChange={(e) => setEdit({ ...edit, [field.key]: Number(e.target.value) || 0 })}
                  className="text-right"
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-dashed border-muted-foreground/15 text-sm">
              <span className="font-bold">Total alloue</span>
              <span className={`font-bold tabular-nums ${edit.bien + edit.travaux + edit.notaire + edit.agence + edit.autre !== loan.montantEmprunte ? "text-destructive" : "text-green-600"}`}>
                {formatCurrency(edit.bien + edit.travaux + edit.notaire + edit.agence + edit.autre)} / {formatCurrency(loan.montantEmprunte)}
              </span>
            </div>
            <Button type="submit" className="w-full">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Property is past the "acte" phase — financial data is meaningful */
function isPostActe(statut?: PropertyStatus): boolean {
  if (!statut) return true; // backward compat
  const idx = PROPERTY_STATUS_ORDER.indexOf(statut);
  const acteIdx = PROPERTY_STATUS_ORDER.indexOf("acte");
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

  const mensualiteCredit = loan
    ? calculerMensualite(loan.montantEmprunte, loan.tauxAnnuel, loan.dureeAnnees, loan.type)
    : 0;

  const handleSetLoan = (loanData: Parameters<typeof setLoan>[0]) => {
    setLoan(loanData);
    const mensualite = calculerMensualite(loanData.montantEmprunte, loanData.tauxAnnuel, loanData.dureeAnnees, loanData.type);
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

  // Lot → Income sync: each lot creates/updates a matching income entry
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
        <div className="flex items-start justify-between mt-4">
          <div>
            <div className="flex items-center gap-3">
              <h1>{property.nom}</h1>
              <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">{property.adresse}</p>
            <p className="text-sm text-muted-foreground">
              Achat : {formatCurrency(property.prixAchat)} — {property.dateAchat}
              {property.surfaceM2 ? ` — ${property.surfaceM2} m²` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/loyers?propertyId=${id}`}
              className="text-sm text-primary hover:underline"
              title="Ouvrir le suivi des loyers de ce bien"
            >
              Suivi loyers
            </Link>
            <Link
              href={`/simulateur?bienId=${id}`}
              className="text-sm text-primary hover:underline"
              title="Ouvrir ce bien dans le simulateur"
            >
              Simuler
            </Link>
            <Link
              href={`/biens/modifier?id=${id}`}
              className="text-sm text-primary hover:underline"
            >
              Modifier
            </Link>
            <button
              onClick={() => { setDeleteConfirmText(""); setDeleteOpen(true); }}
              className="text-sm text-destructive hover:underline"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>

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
        onChange={(s: PropertyStatus) => {
          const today = new Date().toISOString().slice(0, 10);
          const prevDates = property.statusDates ?? {};
          const nextDates = prevDates[s] ? prevDates : { ...prevDates, [s]: today };
          updateProperty(id, { statut: s, statusDates: nextDates });
        }}
        onDateChange={(s, date) => {
          const prevDates = property.statusDates ?? {};
          updateProperty(id, { statusDates: { ...prevDates, [s]: date } });
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
      <PropertySummary property={property} expenses={expenses} incomes={incomes} />

      <Separator className="border-dashed" />

      {/* Credit */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2>Credit</h2>
          <LoanForm propertyId={id} initialData={loan ?? undefined} onSubmit={handleSetLoan} />
        </div>
        {loan ? (
          <Card className="border-dotted">
            <CardContent className="p-4">
              {loan.banque && (
                <p className="text-xs text-muted-foreground mb-3">🏦 {loan.banque}</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Montant emprunte</p>
                  <p className="font-bold">{formatCurrency(loan.montantEmprunte)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Taux</p>
                  <p className="font-bold">{(loan.tauxAnnuel * 100).toFixed(2)} %</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duree</p>
                  <p className="font-bold">{loan.dureeAnnees} ans</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mensualite</p>
                  <p className="font-bold">{formatCurrency(mensualiteCredit + (loan.assuranceAnnuelle / 12), true)}</p>
                </div>
              </div>
              {/* Allocation du credit */}
              <AllocationSection
                loan={loan}
                property={property}
                onSave={(alloc) => updateProperty(id, { allocationCredit: alloc })}
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
            <ExpenseList expenses={expenses} onDelete={deleteExpense} onUpdate={updateExpense} />
          </CardContent>
        </Card>
      </section>

      {/* Lots */}
      <section>
        <LotSection lots={lots} onAdd={handleAddLot} onUpdate={handleUpdateLot} onDelete={handleDeleteLot} propertyId={id} propertyStatut={property.statut} />
      </section>


      {/* Flux mensuels — only for post-acte properties */}
      {isPostActe(property.statut) && (
        <section>
          <Card className="border-dotted">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Flux mensuels depuis l&apos;acquisition</CardTitle>
            </CardHeader>
            <CardContent>
              <CashFlowChart property={property} incomes={incomes} expenses={expenses} rentEntries={rentEntries} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Reel vs Simule */}
      {property.simulationId && (
        <section>
          <RealVsSimulatedSection property={property} incomes={incomes} expenses={expenses} />
        </section>
      )}

      <Separator className="border-dashed" />

      {/* Travaux */}
      <section>
        <InterventionSection interventions={interventions} onAdd={addIntervention} onUpdate={handleUpdateIntervention} onDelete={deleteIntervention} propertyId={id} filterType="travaux" lots={lots} />
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
        <DocumentSection documents={documents} onAdd={addDocument} onDelete={handleDeleteDocument} propertyId={id} />
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
