"use client";

import { useRouter } from "next/navigation";
import { useAppData } from "@/hooks/useLocalStorage";
import { useProperties } from "@/hooks/useProperties";
import { PropertyForm } from "@/components/property/PropertyForm";
import { mensualiteAmortissement } from "@/lib/calculations/loan";
import Link from "next/link";

export default function NouveauBien() {
  const { data, setData } = useAppData();
  const { addProperty } = useProperties(data, setData);
  const router = useRouter();

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
        ← Tableau de bord
      </Link>
      <h1 className="mt-4 mb-6">Nouveau bien</h1>
      <div className="border border-dotted rounded-md p-6">
        <PropertyForm
          showFinancement
          onSubmit={(formData, loanData) => {
            const today = new Date().toISOString().slice(0, 10);
            const id = addProperty({
              ...formData,
              statut: "prospection",
              statusDates: { prospection: today },
            });

            // If the user filled the financing section, create the loan + credit expense
            if (loanData && loanData.montantEmprunte > 0) {
              const loanId = crypto.randomUUID();
              const loan = { ...loanData, id: loanId, propertyId: id };
              const mensualite = mensualiteAmortissement(loan);
              const assurMensuelle = loan.assuranceAnnuelle / 12;
              const montantCredit = Math.round((mensualite + assurMensuelle) * 100) / 100;

              setData((prev) => ({
                ...prev,
                loans: [...prev.loans, loan],
                expenses: [
                  ...prev.expenses,
                  {
                    id: crypto.randomUUID(),
                    propertyId: id,
                    categorie: "credit" as const,
                    label: "Mensualite credit",
                    montant: montantCredit,
                    frequence: "mensuel" as const,
                    dateDebut: loan.dateDebut,
                    notes: "",
                    createdAt: today,
                    updatedAt: today,
                  },
                ],
              }));
            }

            router.push(`/biens?id=${id}`);
          }}
        />
      </div>
    </div>
  );
}
