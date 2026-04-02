"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAppData } from "@/hooks/useLocalStorage";
import { useProperties } from "@/hooks/useProperties";
import { useExpenses } from "@/hooks/useExpenses";
import { useIncomes } from "@/hooks/useIncomes";
import { useLoans } from "@/hooks/useLoans";
import { PROPERTY_TYPE_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { calculerMensualite } from "@/lib/calculations";
import { PropertySummary } from "@/components/property/PropertySummary";
import { ExpenseList } from "@/components/property/ExpenseList";
import { ExpenseForm } from "@/components/property/ExpenseForm";
import { IncomeList } from "@/components/property/IncomeList";
import { IncomeForm } from "@/components/property/IncomeForm";
import { LoanForm } from "@/components/property/LoanForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function PropertyDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { data, setData } = useAppData();
  const { getProperty } = useProperties(data, setData);
  const { expenses, addExpense, deleteExpense } = useExpenses(data, setData, id ?? undefined);
  const { incomes, addIncome, deleteIncome } = useIncomes(data, setData, id ?? undefined);
  const { loan, setLoan, deleteLoan } = useLoans(data, setData, id ?? undefined);

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
          <Link
            href={`/biens/modifier?id=${id}`}
            className="text-sm text-primary hover:underline"
          >
            Modifier
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <PropertySummary property={property} expenses={expenses} incomes={incomes} />

      <Separator className="border-dashed" />

      {/* Credit */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2>Credit</h2>
          <LoanForm propertyId={id} initialData={loan ?? undefined} onSubmit={setLoan} />
        </div>
        {loan ? (
          <Card className="border-dotted">
            <CardContent className="p-4">
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
              <button
                onClick={() => deleteLoan(loan.id)}
                className="text-xs text-destructive hover:underline mt-3"
              >
                Supprimer le credit
              </button>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun credit enregistre.</p>
        )}
      </section>

      <Separator className="border-dashed" />

      {/* Revenus */}
      <section>
        <Card className="border-dotted">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Revenus</CardTitle>
            <IncomeForm propertyId={id} onSubmit={addIncome} />
          </CardHeader>
          <CardContent>
            <IncomeList incomes={incomes} onDelete={deleteIncome} />
          </CardContent>
        </Card>
      </section>

      {/* Depenses */}
      <section>
        <Card className="border-dotted">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Depenses</CardTitle>
            <ExpenseForm propertyId={id} onSubmit={addExpense} />
          </CardHeader>
          <CardContent>
            <ExpenseList expenses={expenses} onDelete={deleteExpense} />
          </CardContent>
        </Card>
      </section>

      {/* Lien calculateur */}
      <div className="text-center">
        <Link
          href={`/calculateur?bienId=${id}`}
          className="text-primary hover:underline text-sm"
        >
          Simuler la rentabilite de ce bien →
        </Link>
      </div>
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
