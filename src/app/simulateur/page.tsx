"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useDonnees } from "@/hooks/useLocalStorage";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { calculerRentabilite } from "@/lib/calculs";
import { chargerSimulations, sauvegarderSimulation, supprimerSimulation, exporterSimulations, importerSimulations, hydraterSimulation, restaurerSnapshot } from "@/lib/simulations";
import { SimulationCard, BienCard, ChargesCard, FinancementCard, FiscaliteCard } from "@/components/calculateur/FormulaireCalculateur";
import { PanneauResultatsCalculateur } from "@/components/calculateur/PanneauResultatsCalculateur";
import { ComparaisonRegimes } from "@/components/calculateur/ComparaisonRegimes";
import { GraphSensibilite } from "@/components/calculateur/GraphSensibilite";
import dynamic from "next/dynamic";
// recharts (~8.5 MB) lives only inside GraphResultats — lazy-load it.
const GraphResultats = dynamic(
  () => import("@/components/calculateur/GraphResultats").then((m) => m.GraphResultats),
  { ssr: false, loading: () => <div className="h-[300px] border border-dashed rounded-md" /> }
);
// ModaleHistorique: only loaded when the user opens it (see conditional render below).
const ModaleHistorique = dynamic(
  () => import("@/components/calculateur/ModaleHistorique").then((m) => m.ModaleHistorique),
  { ssr: false }
);
import type { EntreesCalculateur, SimulationSauvegardee, PieceJointe } from "@/types";
import { PanneauPiecesJointes } from "@/components/calculateur/PanneauPiecesJointes";
import { bienToSimulation } from "@/lib/bienToSimulation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { simulationToBien } from "@/lib/simulationToBien";
import { useRouter } from "next/navigation";

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
  simulations: SimulationSauvegardee[];
  activeId: string | null;
  onLoad: (sim: SimulationSauvegardee) => void;
  onDelete: (sim: SimulationSauvegardee) => void;
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

function SimulateurContent() {
  const searchParams = useSearchParams();
  const bienId = searchParams.get("bienId");
  const simId = searchParams.get("simId");
  const { data, setData } = useDonnees();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const initialInputs = useMemo(() => {
    if (!bienId || !data) return DEFAULT_CALCULATOR_INPUTS;
    const fromBien = bienToSimulation(data, bienId);
    return fromBien ?? DEFAULT_CALCULATOR_INPUTS;
  }, [bienId, data]);

  const [inputs, setInputs] = useState<EntreesCalculateur>(initialInputs);
  const [simulations, setSimulations] = useState<SimulationSauvegardee[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const loadedBienIdRef = useRef<string | null>(null);

  // The active simulation id lives inside `inputs.id` — this makes saves idempotent:
  // saving twice in a row overwrites the same record instead of creating duplicates.
  const activeSimId = inputs.id ?? null;
  const activeSim = simulations.find((s) => s.id === activeSimId);
  const activeHistory = activeSim?.history ?? [];

  useEffect(() => {
    const sims = chargerSimulations();
    setSimulations(sims);
    // Priorite : ?simId=... (ouvre une simulation specifique), sinon le dernier
    // enregistrement si aucun bienId. bienId est traite dans un effet separe.
    if (!initialLoaded) {
      if (simId) {
        const target = sims.find((s) => s.id === simId);
        if (target) {
          hydraterSimulation(target).then((hydrated) => {
            setInputs({ ...DEFAULT_CALCULATOR_INPUTS, ...hydrated });
          });
        }
      } else if (!bienId && sims.length > 0) {
        const mostRecent = sims.reduce((a, b) => (a.savedAt > b.savedAt ? a : b));
        hydraterSimulation(mostRecent).then((hydrated) => {
          setInputs({ ...DEFAULT_CALCULATOR_INPUTS, ...hydrated });
        });
      }
    }
    setInitialLoaded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load simulation from a bien when bienId changes (after data has loaded)
  useEffect(() => {
    if (!bienId || !data) return;
    if (loadedBienIdRef.current === bienId) return;
    const fromBien = bienToSimulation(data, bienId);
    if (fromBien) {
      setInputs({ ...fromBien, id: undefined });
      loadedBienIdRef.current = bienId;
      toast.info(`Bien "${fromBien.nomSimulation}" charge dans le simulateur`);
    }
  }, [bienId, data]);

  const handleUpdate = useCallback(<K extends keyof EntreesCalculateur>(key: K, value: EntreesCalculateur[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    const sim = await sauvegarderSimulation(inputs.nomSimulation, inputs);
    setSimulations(chargerSimulations());
    // Persist the assigned id back into the form state so the next save overwrites
    setInputs(prev => ({ ...prev, id: sim.id }));
    toast.success(`"${sim.nom}" sauvegardee`);
  };

  const handleLoad = async (sim: SimulationSauvegardee) => {
    const hydrated = await hydraterSimulation(sim);
    setInputs({ ...DEFAULT_CALCULATOR_INPUTS, ...hydrated });
    setDrawerOpen(false);
  };

  const handleDelete = async (sim: SimulationSauvegardee) => {
    await supprimerSimulation(sim.id);
    setSimulations(chargerSimulations());
    if (inputs.id === sim.id) {
      setInputs(prev => ({ ...prev, id: undefined }));
    }
    toast.success(`"${sim.nom}" supprimee`);
  };

  const handleExport = async () => {
    toast.info("Export en cours...");
    const json = await exporterSimulations();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Simulations exportees (avec fichiers joints)");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const merged = await importerSimulations(reader.result as string);
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
    setInputs({ ...DEFAULT_CALCULATOR_INPUTS, id: undefined });
    setDrawerOpen(false);
  };

  const handleRestoreSnapshot = async (index: number) => {
    if (!activeSimId) return;
    const restored = await restaurerSnapshot(activeSimId, index);
    if (restored) {
      setInputs({ ...DEFAULT_CALCULATOR_INPUTS, ...restored });
      setHistoryOpen(false);
      toast.success("Version restauree — sauvegarde pour la conserver");
    }
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
            <h1 className="text-xl sm:text-2xl">{inputs.nomSimulation || "Simulateur de rentabilite"}</h1>
            <div className="flex items-center gap-2">
              {activeSimId && activeHistory.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHistoryOpen(true)}
                  className="text-xs shrink-0"
                  title="Voir les versions precedentes"
                >
                  Historique ({activeHistory.length})
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  // Garantit que la simulation est sauvegardee AVANT de creer
                  // le bien — sinon property.simulationId reste undefined et
                  // le "Snapshot simulation initiale" ne peut pas s'afficher.
                  let simId = activeSimId;
                  let inputsWithId = inputs;
                  if (!simId) {
                    const sim = await sauvegarderSimulation(inputs.nomSimulation, inputs);
                    simId = sim.id;
                    inputsWithId = { ...inputs, id: sim.id };
                    setInputs(inputsWithId);
                    setSimulations(chargerSimulations());
                  }
                  const id = simulationToBien(inputsWithId, setData, simId);
                  toast.success("Bien cree a partir de la simulation");
                  router.push(`/biens?id=${id}`);
                }}
                className="text-xs shrink-0"
              >
                Creer le bien
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  toast.info("Generation en cours...");
                  // Lazy-load report module + jspdf only when the user clicks.
                  const { generateReport } = await import("@/lib/report");
                  await generateReport(inputs, results);
                  toast.success("Dossier PDF genere");
                }}
                className="text-xs shrink-0"
              >
                Generer le dossier PDF
              </Button>
            </div>
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
          <PanneauResultatsCalculateur results={results} inputs={inputs} associes={data?.settings?.associes} differePretMois={inputs.differePretMois} />

          {/* Multi-regime comparison */}
          <ComparaisonRegimes inputs={inputs} />

          {/* Sensitivity analysis */}
          <GraphSensibilite inputs={inputs} />

          {/* Projection chart + table — full width */}
          <GraphResultats
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
            <PanneauPiecesJointes
              attachments={inputs.attachments ?? []}
              onChange={(attachments) => handleUpdate("attachments", attachments)}
            />
          </div>
        </div>
      </div>

      {historyOpen && (
        <ModaleHistorique
          open={historyOpen}
          simulationNom={activeSim?.nom ?? inputs.nomSimulation}
          history={activeHistory}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestoreSnapshot}
        />
      )}
    </>
  );
}

export default function Simulateur() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <SimulateurContent />
    </Suspense>
  );
}
