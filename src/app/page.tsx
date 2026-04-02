"use client";

import Link from "next/link";
import { useAppData } from "@/hooks/useLocalStorage";
import { PropertyCard } from "@/components/dashboard/PropertyCard";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Dashboard() {
  const { data, setData } = useAppData();

  if (!data) return null;

  const { properties, settings } = data;

  const toggleRegime = () => {
    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        regimeFiscal: prev.settings.regimeFiscal === "IR" ? "IS" : "IR",
      },
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1>{settings.nomSCI}</h1>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={toggleRegime}
          >
            SCI a l&apos;{settings.regimeFiscal}
          </Badge>
        </div>
        <Link href="/biens/nouveau">
          <Button>+ Nouveau bien</Button>
        </Link>
      </div>

      {/* KPIs */}
      {properties.length > 0 && (
        <>
          <PortfolioSummary data={data} />
          <Separator className="border-dashed" />
        </>
      )}

      {/* Liste des biens */}
      {properties.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-md">
          <p className="text-muted-foreground mb-4">Aucun bien immobilier enregistre.</p>
          <Link href="/biens/nouveau">
            <Button size="lg">Ajouter votre premier bien</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              expenses={data.expenses.filter((e) => e.propertyId === property.id)}
              incomes={data.incomes.filter((i) => i.propertyId === property.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
