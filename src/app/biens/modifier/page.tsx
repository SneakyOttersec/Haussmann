"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDonnees } from "@/hooks/useLocalStorage";
import { useBiens } from "@/hooks/useBiens";
import { PropertyForm } from "@/components/property/PropertyForm";
import { Button } from "@/components/ui/button";

function ModifierBienContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { data, setData } = useDonnees();
  const { obtenirBien, mettreAJourBien, supprimerBien } = useBiens(data, setData);
  const router = useRouter();

  if (!data || !id) return null;

  const property = obtenirBien(id);
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

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/biens?id=${id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
        ← Retour au bien
      </Link>
      <h1 className="mt-4 mb-6">Modifier : {property.nom}</h1>
      <div className="border border-dotted rounded-md p-6">
        <PropertyForm
          initialData={property}
          submitLabel="Enregistrer"
          onSubmit={(formData) => {
            mettreAJourBien(id, formData);
            router.push(`/biens?id=${id}`);
          }}
        />
      </div>
      <div className="mt-8 border border-dashed border-destructive/50 rounded-md p-4">
        <h2 className="text-destructive text-sm font-bold mb-2">Zone dangereuse</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Supprimer ce bien et toutes ses donnees (depenses, revenus, credit).
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (confirm("Supprimer ce bien et toutes ses donnees ?")) {
              supprimerBien(id);
              router.push("/");
            }
          }}
        >
          Supprimer le bien
        </Button>
      </div>
    </div>
  );
}

export default function ModifierBien() {
  return (
    <Suspense fallback={null}>
      <ModifierBienContent />
    </Suspense>
  );
}
