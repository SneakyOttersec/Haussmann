"use client";

import { useRouter } from "next/navigation";
import { useAppData } from "@/hooks/useLocalStorage";
import { useProperties } from "@/hooks/useProperties";
import { PropertyForm } from "@/components/property/PropertyForm";
import Link from "next/link";

export default function NouveauBien() {
  const { data, setData } = useAppData();
  const { addProperty } = useProperties(data, setData);
  const router = useRouter();

  if (!data) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
        ← Tableau de bord
      </Link>
      <h1 className="mt-4 mb-6">Nouveau bien</h1>
      <div className="border border-dotted rounded-md p-6">
        <PropertyForm
          onSubmit={(formData) => {
            const id = addProperty(formData);
            router.push(`/biens?id=${id}`);
          }}
        />
      </div>
    </div>
  );
}
