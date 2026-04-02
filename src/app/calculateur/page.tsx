"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAppData } from "@/hooks/useLocalStorage";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { calculerRentabilite } from "@/lib/calculations";
import { loadSimulations, saveSimulation, deleteSimulation, exportSimulations, importSimulations, hydrateSimulation } from "@/lib/simulations";
import { SimulationCard, BienCard, ChargesCard, FinancementCard, FiscaliteCard } from "@/components/calculator/CalculatorForm";
import { CalculatorResultsPanel } from "@/components/calculator/CalculatorResults";
import { ResultsChart } from "@/components/calculator/ResultsChart";
import type { CalculatorInputs, SavedSimulation, Attachment } from "@/types";
import { AttachmentsPanel } from "@/components/calculator/AttachmentsPanel";
import { annualiserMontant, mensualiserMontant } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateReport } from "@/lib/report";

/* ── Sidebar content (shared between desktop & mobile drawer) ── */

function SimulationList({
  simulations,
  activeId,
  onLoad,
  onDelete,
  onSave,
  onNew,
  onExport,
  onImportClick,
}: {
  simulations: SavedSimulation[];
  activeId: string | null;
  onLoad: (sim: SavedSimulation) => void;
  onDelete: (sim: SavedSimulation) => void;
  onSave: () => void;
  onNew: () => void;
  onExport: () => void;
  onImportClick: () => void;
}) {
  return (
    <div className="space-y-4 h-full flex flex-col">
      <h2 className="text-sm shrink-0">Simulations</h2>

      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={onSave} className="flex-1 text-xs">
          Sauvegarder
        </Button>
        <Button size="sm" variant="outline" onClick={onNew} className="text-xs">
          + Nouvelle
        </Button>
      </div>

      <hr className="border-dashed border-muted-foreground/20 shrink-0" />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {simulations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune simulation sauvegardee.</p>
        ) : (
          <nav className="space-y-1">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className={`group flex items-center justify-between rounded-md px-2 py-2 text-xs cursor-pointer transition-colors ${
                  activeId === sim.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => onLoad(sim)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{sim.nom}</p>
                  <p className="text-[10px] opacity-60">
                    {new Date(sim.savedAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(sim); }}
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 ml-2 text-base leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </nav>
        )}
      </div>

      <hr className="border-dashed border-muted-foreground/20 shrink-0" />

      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={onExport} className="flex-1 text-xs">
          Exporter
        </Button>
        <Button size="sm" variant="outline" onClick={onImportClick} className="flex-1 text-xs">
          Importer
        </Button>
      </div>
    </div>
  );
}

/* ── Main page ── */

function CalculateurContent() {
  const searchParams = useSearchParams();
  const bienId = searchParams.get("bienId");
  const { data } = useAppData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const initialInputs = useMemo(() => {
    if (!bienId || !data) return DEFAULT_CALCULATOR_INPUTS;

    const property = data.properties.find((p) => p.id === bienId);
    if (!property) return DEFAULT_CALCULATOR_INPUTS;

    const propertyIncomes = data.incomes.filter((i) => i.propertyId === bienId);
    const propertyExpenses = data.expenses.filter((e) => e.propertyId === bienId && e.categorie !== "credit");
    const loan = data.loans.find((l) => l.propertyId === bienId);

    const loyerMensuel = propertyIncomes
      .filter((i) => i.categorie === "loyer")
      .reduce((sum, i) => sum + mensualiserMontant(i.montant, i.frequence), 0);
    const chargesCopro = propertyExpenses
      .filter((e) => e.categorie === "copropriete")
      .reduce((sum, e) => sum + annualiserMontant(e.montant, e.frequence), 0);
    const taxeFonciere = propertyExpenses
      .filter((e) => e.categorie === "taxe_fonciere")
      .reduce((sum, e) => sum + annualiserMontant(e.montant, e.frequence), 0);
    const assurancePNO = propertyExpenses
      .filter((e) => e.categorie === "assurance_pno")
      .reduce((sum, e) => sum + annualiserMontant(e.montant, e.frequence), 0);

    return {
      ...DEFAULT_CALCULATOR_INPUTS,
      nomSimulation: property.nom,
      adresse: property.adresse,
      prixAchat: property.prixAchat,
      fraisNotairePct: property.prixAchat > 0 ? property.fraisNotaire / property.prixAchat : 0.08,
      montantTravaux: property.montantTravaux,
      loyerMensuel,
      chargesCopro,
      taxeFonciere,
      assurancePNO,
      regimeFiscal: data.settings.regimeFiscal,
      ...(loan ? {
        montantEmprunte: loan.montantEmprunte,
        tauxCredit: loan.tauxAnnuel,
        dureeCredit: loan.dureeAnnees,
        typePret: loan.type,
        assurancePretAnnuelle: loan.assuranceAnnuelle,
      } : {}),
    };
  }, [bienId, data]);

  const [inputs, setInputs] = useState<CalculatorInputs>(initialInputs);
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);

  useEffect(() => { setSimulations(loadSimulations()); }, []);

  const handleUpdate = useCallback(<K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    const sim = await saveSimulation(inputs.nomSimulation, inputs, activeSimId);
    setSimulations(loadSimulations());
    setActiveSimId(sim.id);
    toast.success(`"${sim.nom}" sauvegardee`);
  };

  const handleLoad = async (sim: SavedSimulation) => {
    const hydrated = await hydrateSimulation(sim);
    setInputs({ ...DEFAULT_CALCULATOR_INPUTS, ...hydrated });
    setActiveSimId(sim.id);
    setDrawerOpen(false);
  };

  const handleDelete = async (sim: SavedSimulation) => {
    await deleteSimulation(sim.id);
    setSimulations(loadSimulations());
    if (activeSimId === sim.id) setActiveSimId(null);
    toast.success(`"${sim.nom}" supprimee`);
  };

  const handleExport = () => {
    const json = exportSimulations();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Simulations exportees");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const merged = importSimulations(reader.result as string);
        setSimulations(merged);
        toast.success(`${merged.length} simulation(s) importee(s)`);
      } catch {
        toast.error("Fichier invalide");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleNew = () => {
    setInputs(DEFAULT_CALCULATOR_INPUTS);
    setActiveSimId(null);
    setDrawerOpen(false);
  };

  const results = calculerRentabilite(inputs);

  const sidebarProps = {
    simulations,
    activeId: activeSimId,
    onLoad: handleLoad,
    onDelete: handleDelete,
    onSave: handleSave,
    onNew: handleNew,
    onExport: handleExport,
    onImportClick: () => fileInputRef.current?.click(),
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r border-dashed border-muted-foreground/30 p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold">Simulations</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-muted-foreground hover:text-primary text-lg">×</button>
            </div>
            <SimulationList {...sidebarProps} />
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="w-52 shrink-0 border-r border-dashed border-muted-foreground/20 pr-4 hidden lg:block">
          <div className="sticky top-20">
            <SimulationList {...sidebarProps} />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile top bar */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              className="shrink-0 h-8 px-2 rounded-md border border-dotted text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
            >
              Simulations ({simulations.length})
            </button>
            <Button size="sm" onClick={handleSave} className="shrink-0 text-xs">
              Sauvegarder
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl">{inputs.nomSimulation || "Calculateur de rentabilite"}</h1>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => { toast.info("Generation en cours..."); await generateReport(inputs, results); toast.success("Dossier PDF genere"); }}
              className="text-xs shrink-0"
            >
              Generer le dossier PDF
            </Button>
          </div>

          {/* Simulation — full width */}
          <SimulationCard inputs={inputs} onUpdate={handleUpdate} />

          {/* 2 balanced columns: Bien & Revenus | Financement + Fiscalite */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BienCard inputs={inputs} onUpdate={handleUpdate} />
            <div className="space-y-4">
              <FinancementCard inputs={inputs} onUpdate={handleUpdate} />
              <FiscaliteCard inputs={inputs} onUpdate={handleUpdate} />
            </div>
          </div>

          {/* Charges — full width */}
          <ChargesCard inputs={inputs} onUpdate={handleUpdate} />

          {/* Results — full width */}
          <CalculatorResultsPanel results={results} />

          {/* Projection chart + table — full width */}
          <ResultsChart
            projection={results.projection}
            inputs={inputs}
            results={results}
            onUpdateEvolutions={(evolutions) => handleUpdate("evolutions", evolutions)}
          />

          {/* Points notables + Pieces jointes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-dotted rounded-lg p-5 space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider">Points notables</h2>
              <textarea
                value={inputs.pointsNotables ?? ""}
                onChange={(e) => handleUpdate("pointsNotables", e.target.value)}
                placeholder="Notes, remarques, points d'attention sur ce projet..."
                rows={5}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none resize-y focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 placeholder:text-muted-foreground"
              />
            </div>
            <AttachmentsPanel
              attachments={inputs.attachments ?? []}
              onChange={(attachments) => handleUpdate("attachments", attachments)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default function Calculateur() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <CalculateurContent />
    </Suspense>
  );
}
