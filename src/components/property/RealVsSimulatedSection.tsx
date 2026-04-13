"use client";

import { useState, useEffect, useMemo } from "react";
import type { Property, Income, Expense, LoanDetails, RentMonthEntry, YearProjection, CalculatorInputs, PropertyStatus } from "@/types";
import { loadSimulations, hydrateSimulation } from "@/lib/simulations";
import { DEFAULT_CALCULATOR_INPUTS } from "@/lib/constants";
import { calculerRentabilite } from "@/lib/calculations";
import Link from "next/link";
import { formatCurrency, formatPercent, generateId, getPropertyAcquisitionDate } from "@/lib/utils";
import { buildMonthlyFlow } from "@/lib/monthlyFlow";

/** Real cash flow only makes sense once the property is generating rent (location or beyond). */
function isOperating(statut?: PropertyStatus): boolean {
  return statut === "location" || statut === "exploitation";
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

const RVS_CURVE_DEFINITIONS: { label: string; color: string; desc: string }[] = [
  { label: "Simule", color: "#60a5fa", desc: "Cash flow projete par la simulation initiale (avec la vacance configuree), annee par annee. Parametres credit patches avec ceux actuels du bien." },
  { label: "Optimum", color: "#a855f7", desc: "Meme simulation mais sans vacance locative (100% d'occupation). Plafond theorique du cash flow." },
  { label: "Reel", color: "#16a34a", desc: "Cash flow reel annualise pour chaque annee d'exploitation, base sur les loyers percus et les charges reelles. S'affiche uniquement a partir de la mise en location." },
];

function RvsCurvesInfo() {
  return (
    <UiTooltip>
      <TooltipTrigger render={
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors select-none cursor-help"
        />
      }>
        <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-current text-[9px] leading-none">?</span>
        Information
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="bg-background text-foreground border border-dotted border-muted-foreground/30 shadow-lg p-3 max-w-xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 font-mono text-[11px]">
          {RVS_CURVE_DEFINITIONS.map((d) => (
            <div key={d.label} className="space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.label}
              </div>
              <div className="text-muted-foreground leading-snug">{d.desc}</div>
            </div>
          ))}
        </div>
      </TooltipContent>
    </UiTooltip>
  );
}

interface Props {
  property: Property;
  incomes: Income[];
  expenses: Expense[];
  rentEntries: RentMonthEntry[];
  loan?: LoanDetails | null;
  /** Callback pour persister lock / overrides / history du snapshot. */
  onUpdateProperty?: (updates: Partial<Property>) => void;
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(v).replace(/\u00A0/g, " ").replace(/\u202F/g, " ");

interface SimBreakdown {
  loyerNet: number;
  charges: number;
  mensualitesCredit: number;
  cashFlowAvantImpot: number;
  /** True if this year is (fully or partially) in the loan defer phase. */
  isDiffere: boolean;
}

interface RealBreakdown {
  loyersPercus: number;
  revenusAutres: number;
  depenses: number;
  credit: number;
  cashFlow: number;
  monthsUsed: number;
  isExtrapolated: boolean;
}

interface RealYearData {
  yearIdx: number;
  annualCF: number;
  monthsUsed: number;
  isExtrapolated: boolean;
  breakdown: { loyersPercus: number; revenusAutres: number; depenses: number; credit: number };
}

interface ChartPoint {
  annee: string;
  simule: number;
  optimum: number | null;
  reel: number | null;
  simBreakdown: SimBreakdown;
  realBreakdown: RealBreakdown | null;
}

// Tooltip rows are hoisted out of the parent function so React Compiler can
// memoize them properly (defining components inside render confuses the compiler).
function TooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ color: color ?? "#666" }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? undefined, fontVariantNumeric: "tabular-nums" }}>
        {fmtEur(value)}
      </span>
    </div>
  );
}

function TooltipTotal({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        marginTop: 4,
        paddingTop: 4,
        borderTop: "1px dashed #ccc",
      }}
    >
      <span style={{ fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 700, color: value >= 0 ? "#16a34a" : "#991b1b", fontVariantNumeric: "tabular-nums" }}>
        {fmtEur(value)}
      </span>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function BreakdownTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) return null;
  const sim = point.simBreakdown;
  const real = point.realBreakdown;
  const ecart = real ? real.cashFlow - sim.cashFlowAvantImpot : 0;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 11,
        lineHeight: 1.7,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        minWidth: 240,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>

      {/* Simule */}
      <div style={{ marginBottom: real ? 8 : 0 }}>
        <div style={{ color: "#60a5fa", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
          Simule (avant impot)
        </div>
        <TooltipRow label="Loyer net" value={sim.loyerNet} color="#16a34a" />
        <TooltipRow label="− Charges" value={-sim.charges} color="#fb923c" />
        <TooltipRow
          label={sim.isDiffere ? "− Credit (differe: interets seuls)" : "− Mensualites credit"}
          value={-sim.mensualitesCredit}
          color={sim.isDiffere ? "#f59e0b" : "#60a5fa"}
        />
        <TooltipTotal label="= Cash flow" value={sim.cashFlowAvantImpot} />
      </div>

      {/* Reel — only on the matching year */}
      {real && (
        <div>
          <div style={{ color: "#16a34a", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Reel (avant impot){real.isExtrapolated ? ` — extrapole sur ${real.monthsUsed}m` : " — 12 derniers mois"}
          </div>
          <TooltipRow label="Loyers percus" value={real.loyersPercus} color="#16a34a" />
          {real.revenusAutres !== 0 && <TooltipRow label="+ Autres revenus" value={real.revenusAutres} color="#a3e635" />}
          <TooltipRow label="− Charges" value={-real.depenses} color="#fb923c" />
          <TooltipRow label="− Credit" value={-real.credit} color="#60a5fa" />
          <TooltipTotal label="= Cash flow" value={real.cashFlow} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              marginTop: 4,
              fontSize: 10,
              color: "#666",
            }}
          >
            <span>Ecart vs simule</span>
            <span style={{ fontWeight: 600, color: ecart >= 0 ? "#16a34a" : "#991b1b", fontVariantNumeric: "tabular-nums" }}>
              {ecart >= 0 ? "+" : ""}{fmtEur(ecart)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Snapshot repliable + verrouillable + editable de la simulation initiale.
 * - Header cliquable pour deplier/replier.
 * - Cadenas (verrouille par defaut) pour autoriser l'edition.
 * - Chaque modification pousse une entree dans property.simulationSnapshotHistory.
 */
function SimSnapshotBlock({
  snapshot,
  property,
  onUpdateProperty,
}: {
  snapshot: SimSnapshot;
  property: Property;
  onUpdateProperty?: (updates: Partial<Property>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const locked = property.simulationSnapshotLocked ?? true;
  const overrides = property.simulationSnapshotOverrides ?? {};
  const history = property.simulationSnapshotHistory ?? [];

  // Valeurs effectives : overrides si presents, sinon snapshot derive.
  type NumField = "loyerMensuelTotal" | "coutTotal" | "apport" | "emprunt" | "mensualiteCredit" | "chargesAnnuelles" | "cashFlowMensuelA1" | "rendementBrut" | "rendementNet" | "tri";
  const getVal = (f: NumField): number => {
    const o = overrides[f];
    if (typeof o === "number") return o;
    return snapshot[f];
  };

  const setField = (field: NumField, newVal: number) => {
    if (!onUpdateProperty) return;
    const oldVal = getVal(field);
    if (Math.abs(oldVal - newVal) < 0.001) {
      setEditingField(null);
      return;
    }
    const newOverrides = { ...overrides, [field]: newVal };
    const newHistory = [
      {
        id: generateId(),
        date: new Date().toISOString(),
        field,
        oldValue: oldVal,
        newValue: newVal,
      },
      ...history,
    ];
    onUpdateProperty({
      simulationSnapshotOverrides: newOverrides,
      simulationSnapshotHistory: newHistory,
    });
    setEditingField(null);
  };

  const toggleLock = () => {
    onUpdateProperty?.({ simulationSnapshotLocked: !locked });
    if (!locked) setEditingField(null); // on re-verrouille: ferme toute edition en cours
  };

  // Champs dont l'override peut reellement modifier la courbe de projection.
  // Les autres (mensualite credit, rendement, cash flow, TRI) sont derives :
  // les editer n'a pas de sens, on les rend non modifiables meme deverrouille.
  const EDITABLE_FIELDS = new Set<NumField>([
    "loyerMensuelTotal",
    "coutTotal",
    "apport",
    "emprunt",
    "chargesAnnuelles",
  ]);

  // Helper : construit les props pour un EditableField a partir d'un champ numerique.
  const editableProps = (field: NumField, format: (v: number) => string, color?: string) => {
    const isEditableField = EDITABLE_FIELDS.has(field);
    return {
      value: getVal(field),
      isOverridden: overrides[field] !== undefined,
      originalValue: snapshot[field],
      isEditing: editingField === field,
      // Force le "locked" si le champ n'est pas editable (derives).
      locked: locked || !isEditableField,
      format,
      color,
      draft,
      setDraft,
      onStartEdit: () => {
        setDraft(String(getVal(field)));
        setEditingField(field);
      },
      onCommit: () => {
        const n = Number(draft);
        if (!isNaN(n)) setField(field, n);
        else setEditingField(null);
      },
      onCancel: () => setEditingField(null),
      onReset: () => resetField(field),
    };
  };

  const resetField = (field: NumField) => {
    if (!onUpdateProperty) return;
    const oldVal = getVal(field);
    const originalVal = snapshot[field];
    const { [field]: _removed, ...rest } = overrides;
    void _removed;
    const newHistory = [
      {
        id: generateId(),
        date: new Date().toISOString(),
        field: `${field} (reset)`,
        oldValue: oldVal,
        newValue: originalVal,
      },
      ...history,
    ];
    onUpdateProperty({
      simulationSnapshotOverrides: rest,
      simulationSnapshotHistory: newHistory,
    });
  };


  return (
    <div className="mt-4 pt-3 border-t border-dashed border-muted-foreground/15">
      {/* Conteneur global : bordure dotted qui englobe header + contenu deplie */}
      <div className="rounded-md border border-dotted border-muted-foreground/30 transition-colors hover:border-muted-foreground/50">
      {/* Header toujours visible — clic pour deplier */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2 rounded-md hover:bg-muted/40 transition-colors">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-xs font-medium text-foreground transition-colors flex-1 text-left cursor-pointer"
          aria-expanded={expanded}
        >
          <span className={`inline-flex items-center justify-center w-4 h-4 rounded border border-current text-[10px] leading-none transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
          <span>Snapshot simulation initiale</span>
          <span className="text-[10px] text-muted-foreground font-normal ml-1">({expanded ? "replier" : "cliquer pour deplier"})</span>
        </button>
        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {property.simulationId && (
            <Link
              href={`/simulateur?simId=${property.simulationId}`}
              className="text-[10px] text-primary hover:underline"
              title="Ouvrir la simulation initiale dans le simulateur"
            >
              ↗ Simulation
            </Link>
          )}
          {onUpdateProperty && (
            <button
              type="button"
              onClick={toggleLock}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                locked
                  ? "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
                  : "border-amber-500/50 bg-amber-500/10 text-amber-700"
              }`}
              title={locked ? "Deverrouiller pour modifier" : "Verrouiller (lecture seule)"}
              aria-pressed={!locked}
            >
              {locked ? "🔒 Verrouille" : "🔓 Deverrouille"}
            </button>
          )}
          <span className="text-[10px] text-muted-foreground/70 font-mono truncate max-w-[40%]" title={snapshot.nomSimulation}>
            {snapshot.nomSimulation}
            {snapshot.savedAt && (<> · {new Date(snapshot.savedAt).toLocaleDateString("fr-FR")}</>)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-dotted border-muted-foreground/20">
          <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px]">
            <EditableField label="Loyer mensuel" {...editableProps("loyerMensuelTotal", (v) => formatCurrency(v))} />
            <EditableField label="Cout total" {...editableProps("coutTotal", (v) => formatCurrency(v))} />
            <div className="flex justify-between items-center gap-2">
              <dt className="text-muted-foreground">Apport / Emprunt</dt>
              <dd className="font-medium tabular-nums">
                <EditableInline
                  value={getVal("apport")}
                  isOverridden={overrides.apport !== undefined}
                  original={snapshot.apport}
                  onCommit={(n) => setField("apport", n)}
                  onReset={() => resetField("apport")}
                  locked={locked}
                  format={(v) => formatCurrency(v)}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  fieldKey="apport"
                  draft={draft}
                  setDraft={setDraft}
                />
                {" / "}
                <EditableInline
                  value={getVal("emprunt")}
                  isOverridden={overrides.emprunt !== undefined}
                  original={snapshot.emprunt}
                  onCommit={(n) => setField("emprunt", n)}
                  onReset={() => resetField("emprunt")}
                  locked={locked}
                  format={(v) => formatCurrency(v)}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  fieldKey="emprunt"
                  draft={draft}
                  setDraft={setDraft}
                />
              </dd>
            </div>
            <EditableField label="Mensualite credit" {...editableProps("mensualiteCredit", (v) => `${formatCurrency(v)}/m`)} />
            <EditableField label="Charges annuelles" {...editableProps("chargesAnnuelles", (v) => formatCurrency(v))} />
            <EditableField
              label="Cash flow A1"
              {...editableProps(
                "cashFlowMensuelA1",
                (v) => `${formatCurrency(v)}/m`,
                getVal("cashFlowMensuelA1") >= 0 ? "text-green-600" : "text-destructive",
              )}
            />
            <div className="flex justify-between items-center gap-2">
              <dt className="text-muted-foreground">Rdt brut / net</dt>
              <dd className="font-medium tabular-nums">
                <EditableInline
                  value={getVal("rendementBrut")}
                  isOverridden={overrides.rendementBrut !== undefined}
                  original={snapshot.rendementBrut}
                  onCommit={(n) => setField("rendementBrut", n)}
                  onReset={() => resetField("rendementBrut")}
                  locked={locked}
                  format={(v) => formatPercent(v)}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  fieldKey="rendementBrut"
                  draft={draft}
                  setDraft={setDraft}
                />
                {" / "}
                <EditableInline
                  value={getVal("rendementNet")}
                  isOverridden={overrides.rendementNet !== undefined}
                  original={snapshot.rendementNet}
                  onCommit={(n) => setField("rendementNet", n)}
                  onReset={() => resetField("rendementNet")}
                  locked={locked}
                  format={(v) => formatPercent(v)}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  fieldKey="rendementNet"
                  draft={draft}
                  setDraft={setDraft}
                />
              </dd>
            </div>
            <EditableField label="TRI 10 ans" {...editableProps("tri", (v) => formatPercent(v * 100))} />
          </dl>

          {history.length > 0 && (
            <div className="border-t border-dashed border-muted-foreground/15 pt-2">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                {historyOpen ? "▾" : "▸"} Historique ({history.length} modification{history.length > 1 ? "s" : ""})
              </button>
              {historyOpen && (
                <div className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <span className="tabular-nums w-20 shrink-0">{new Date(h.date).toLocaleDateString("fr-FR")}</span>
                      <span className="font-mono truncate">{h.field}</span>
                      <span className="tabular-nums">
                        {typeof h.oldValue === "number" ? h.oldValue.toFixed(2) : h.oldValue}
                        {" → "}
                        <span className="text-foreground">{typeof h.newValue === "number" ? h.newValue.toFixed(2) : h.newValue}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// Top-level stable component — if defined inside SimSnapshotBlock the input
// loses focus on every keystroke (React treats it as a new component type).
function EditableField({
  label, value, isOverridden, originalValue, isEditing, locked, format, color,
  draft, setDraft, onStartEdit, onCommit, onCancel, onReset,
}: {
  label: string;
  value: number;
  isOverridden: boolean;
  originalValue: number;
  isEditing: boolean;
  locked: boolean;
  format: (v: number) => string;
  color?: string;
  draft: string;
  setDraft: (s: string) => void;
  onStartEdit: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex justify-between items-center gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      {isEditing ? (
        <input
          autoFocus
          type="number"
          step="any"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCommit(); }
            if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          }}
          onBlur={onCommit}
          className="w-24 h-6 px-1.5 text-[11px] text-right tabular-nums border border-input rounded bg-transparent outline-none focus:border-ring"
        />
      ) : (
        <dd className={`font-medium tabular-nums flex items-center gap-1 ${color ?? ""}`}>
          {format(value)}
          {isOverridden && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              className="text-[8px] text-amber-600 hover:text-destructive"
              title={`Reinitialiser (original : ${format(originalValue)})`}
            >
              ↺
            </button>
          )}
          {!locked && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
              className="text-[9px] opacity-50 hover:opacity-100 hover:text-primary"
              title="Modifier"
            >
              ✎
            </button>
          )}
        </dd>
      )}
    </div>
  );
}

// Helper sub-component for the combined Apport/Emprunt and Rdt brut/net rows
// where two editable values share a cell.
function EditableInline({
  value, isOverridden, original, onCommit, onReset, locked, format, editingField, setEditingField, fieldKey, draft, setDraft,
}: {
  value: number;
  isOverridden: boolean;
  original: number;
  onCommit: (n: number) => void;
  onReset: () => void;
  locked: boolean;
  format: (v: number) => string;
  editingField: string | null;
  setEditingField: (f: string | null) => void;
  fieldKey: string;
  draft: string;
  setDraft: (s: string) => void;
}) {
  const isEditing = editingField === fieldKey;
  const commit = () => {
    const n = Number(draft);
    if (!isNaN(n)) onCommit(n);
    else setEditingField(null);
  };
  if (isEditing) {
    return (
      <input
        autoFocus
        type="number"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setEditingField(null); }
        }}
        onBlur={commit}
        className="w-20 h-5 px-1 text-[11px] text-right tabular-nums border border-input rounded bg-transparent outline-none focus:border-ring"
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {format(value)}
      {isOverridden && (
        <button
          type="button"
          onClick={onReset}
          className="text-[8px] text-amber-600 hover:text-destructive"
          title={`Reinitialiser (original : ${format(original)})`}
        >
          ↺
        </button>
      )}
      {!locked && (
        <button
          type="button"
          onClick={() => { setDraft(String(value)); setEditingField(fieldKey); }}
          className="text-[9px] opacity-50 hover:opacity-100 hover:text-primary"
          title="Modifier"
        >
          ✎
        </button>
      )}
    </span>
  );
}

interface SimSnapshot {
  nomSimulation: string;
  savedAt: string;
  prixAchat: number;
  montantTravaux: number;
  loyerMensuelTotal: number;
  coutTotal: number;
  mensualiteCredit: number;
  chargesAnnuelles: number;
  rendementBrut: number;
  rendementNet: number;
  cashFlowMensuelA1: number;
  tri: number;
  apport: number;
  emprunt: number;
}

export function RealVsSimulatedSection({ property, incomes, expenses, rentEntries, loan, onUpdateProperty }: Props) {
  const [projection, setProjection] = useState<YearProjection[] | null>(null);
  const [projectionOptimum, setProjectionOptimum] = useState<YearProjection[] | null>(null);
  const [snapshot, setSnapshot] = useState<SimSnapshot | null>(null);
  const [showSimule, setShowSimule] = useState(true);
  const [showReel, setShowReel] = useState(true);
  const [showOptimum, setShowOptimum] = useState(true);
  // Counter bumped to force-reload the simulation from localStorage.
  // Incremented by a "Recharger" button so the user can pull fresh data
  // after editing the simulation in the simulator.
  const [reloadKey, setReloadKey] = useState(0);
  // Hide the "real" curve until the property is actually generating rent.
  // Until then there is no meaningful real cash flow to compare against the simulator.
  const operating = isOperating(property.statut);

  useEffect(() => {
    if (!property.simulationId) return;
    const sims = loadSimulations();
    const sim = sims.find((s) => s.id === property.simulationId);
    if (!sim) return;
    hydrateSimulation(sim).then((hydrated) => {
      const inputs: CalculatorInputs = { ...DEFAULT_CALCULATOR_INPUTS, ...hydrated };
      // Patch the simulation inputs with the property's CURRENT loan params.
      // The simulation may have been saved before defer was added, or the user
      // may have changed loan terms on the property page without re-saving
      // the simulation. This ensures the chart reflects the actual loan config.
      if (loan) {
        inputs.montantEmprunte = loan.montantEmprunte;
        inputs.tauxCredit = loan.tauxAnnuel;
        inputs.dureeCredit = loan.dureeAnnees;
        inputs.typePret = loan.type;
        inputs.differePretMois = loan.differeMois ?? 0;
        inputs.differePretInclus = loan.differeInclus ?? true;
        if (loan.assuranceAnnuelle > 0) {
          inputs.assurancePretMode = "eur";
          inputs.assurancePretAnnuelle = loan.assuranceAnnuelle;
        }
      }
      // Applique les overrides snapshot (input-level) pour que la courbe
      // reflete les modifications de l'utilisateur. Les champs derivies
      // (mensualite credit, rendement, TRI) restent recalcules a partir
      // des inputs ajustes — overrider ces valeurs directement n'aurait
      // pas de sens pour la courbe de projection annuelle.
      const ov = property.simulationSnapshotOverrides ?? {};
      if (typeof ov.loyerMensuelTotal === "number") {
        inputs.loyerMensuel = ov.loyerMensuelTotal;
        inputs.lots = []; // la surcharge remplace la somme des lots
      }
      if (typeof ov.apport === "number") inputs.apportPersonnel = ov.apport;
      if (typeof ov.emprunt === "number") inputs.montantEmprunte = ov.emprunt;
      if (typeof ov.coutTotal === "number") {
        // Ajuste prixAchat pour que la somme des composants corresponde au
        // nouveau cout total (approximation : absorbe le delta sur prixAchat).
        const fraisNotaire = inputs.prixAchat * inputs.fraisNotairePct;
        const otherCosts = fraisNotaire + (inputs.fraisAgence ?? 0) + (inputs.fraisDossier ?? 0)
          + (inputs.fraisCourtage ?? 0) + inputs.montantTravaux + (inputs.montantMobilierTotal ?? 0);
        inputs.prixAchat = Math.max(0, ov.coutTotal - otherCosts);
      }
      if (typeof ov.chargesAnnuelles === "number") {
        // Somme des charges actuelles, puis redirige tout vers autresCharges
        // pour que le total corresponde a la valeur overridee.
        inputs.chargesCopro = 0;
        inputs.taxeFonciere = 0;
        inputs.assurancePNO = 0;
        inputs.comptabilite = 0;
        inputs.cfeCrl = 0;
        inputs.entretien = 0;
        inputs.gli = 0;
        inputs.gestionLocativePct = 0;
        inputs.autresChargesAnnuelles = ov.chargesAnnuelles;
      }
      const results = calculerRentabilite(inputs);
      setProjection(results.projection);
      // ── Optimum : meme simulation mais SANS vacance locative (pleine occupation) ──
      // Donne le plafond theorique du cash flow.
      const inputsOpt: CalculatorInputs = { ...inputs, tauxVacance: 0 };
      const resultsOpt = calculerRentabilite(inputsOpt);
      setProjectionOptimum(resultsOpt.projection);
      const loyerMensuelTotal = (inputs.lots ?? []).reduce((s, l) => s + (l.loyerMensuel ?? 0), 0)
        || inputs.loyerMensuel
        || 0;
      setSnapshot({
        nomSimulation: sim.nom || inputs.nomSimulation || "Simulation initiale",
        savedAt: sim.savedAt,
        prixAchat: inputs.prixAchat,
        montantTravaux: inputs.montantTravaux,
        loyerMensuelTotal,
        coutTotal: results.coutTotalAcquisition,
        mensualiteCredit: results.mensualiteCredit,
        chargesAnnuelles: results.chargesAnnuellesTotales,
        rendementBrut: results.rendementBrut,
        rendementNet: results.rendementNet,
        cashFlowMensuelA1: results.cashFlowMensuelAvantImpot,
        tri: results.tri,
        apport: results.apportPersonnel,
        emprunt: inputs.montantEmprunte,
      });
    });
  }, [property.simulationId, reloadKey, loan, property.simulationSnapshotOverrides]);

  /**
   * Real cash flow built from the SAME source of truth as the rest of the app:
   * buildMonthlyFlow respects rent tracking, expense revisions, dateDebut/dateFin,
   * and the loan defer schedule. We then sum the trailing 12 months and, if the
   * property is younger than 12 months, extrapolate from what we have so the
   * comparison vs the simulator's annual projection stays meaningful.
   *
   * We also expose the breakdown (loyers / autres revenus / charges / credit) so
   * the chart tooltip can show how the figure was built.
   */
  /**
   * Build real CF per ownership year. Monthly flow is grouped into 12-month
   * windows aligned on the acquisition date: A1 = months 0-11, A2 = months 12-23, etc.
   * The last (current) year may have < 12 months → extrapolated to annual.
   */
  const { realByYear, yearsOwned } = useMemo(() => {
    const monthly = buildMonthlyFlow(property, incomes, expenses, rentEntries, loan ?? null);
    if (monthly.length === 0) return { realByYear: [] as RealYearData[], yearsOwned: 0 };

    const nbYears = Math.max(1, Math.ceil(monthly.length / 12));
    const result: RealYearData[] = [];

    for (let y = 0; y < nbYears; y++) {
      const window = monthly.slice(y * 12, (y + 1) * 12);
      const monthsUsed = window.length;
      if (monthsUsed === 0) continue;
      const sumLoyers = window.reduce((s, m) => s + m.revenusLoyers, 0);
      const sumAutres = window.reduce((s, m) => s + m.revenusAutres, 0);
      const sumDepenses = window.reduce((s, m) => s + m.depenses, 0);
      const sumCredit = window.reduce((s, m) => s + m.credit, 0);
      const sumCF = window.reduce((s, m) => s + m.cashFlow, 0);
      const factor = monthsUsed >= 12 ? 1 : 12 / monthsUsed;
      result.push({
        yearIdx: y, // 0-based → maps to A(y+1)
        annualCF: sumCF * factor,
        monthsUsed,
        isExtrapolated: monthsUsed < 12,
        breakdown: {
          loyersPercus: sumLoyers * factor,
          revenusAutres: sumAutres * factor,
          depenses: sumDepenses * factor,
          credit: sumCredit * factor,
        },
      });
    }
    return { realByYear: result, yearsOwned: nbYears };
  }, [property, incomes, expenses, rentEntries, loan]);

  if (!property.simulationId) return null;
  if (!projection) return null;

  const years = Math.min(10, projection.length);
  // Build a lookup of real data by year index for O(1) access in the loop.
  const realLookup = new Map(realByYear.map((r) => [r.yearIdx, r]));
  const latestReal = realByYear.length > 0 ? realByYear[realByYear.length - 1] : null;

  // L'optimum diverge du simule uniquement si la simulation a un tauxVacance > 0.
  // On detecte cela en comparant le loyer net de A1 entre les deux projections.
  const hasOptimumDelta = projectionOptimum != null
    && projectionOptimum.length > 0
    && projection.length > 0
    && Math.round(projectionOptimum[0].cashFlowAvantImpot) !== Math.round(projection[0].cashFlowAvantImpot);

  const data: ChartPoint[] = [];
  for (let i = 0; i < years; i++) {
    const p = projection[i];
    const pOpt = projectionOptimum?.[i];
    // Show real data for every year we have tracking data — not just one point.
    const realYear = operating ? realLookup.get(i) ?? null : null;
    data.push({
      annee: `A${i + 1}`,
      simule: Math.round(p.cashFlowAvantImpot),
      optimum: hasOptimumDelta && pOpt ? Math.round(pOpt.cashFlowAvantImpot) : null,
      reel: realYear ? Math.round(realYear.annualCF) : null,
      simBreakdown: {
        loyerNet: Math.round(p.loyerNet),
        charges: Math.round(p.charges),
        mensualitesCredit: Math.round(p.mensualitesCredit),
        cashFlowAvantImpot: Math.round(p.cashFlowAvantImpot),
        // Detect defer: if this year's credit is significantly lower than the
        // last projection year's credit (post-amortization), mark as defer.
        isDiffere: i < years - 1 && p.mensualitesCredit > 0 &&
          p.mensualitesCredit < projection[years - 1].mensualitesCredit * 0.9,
      },
      realBreakdown: realYear
        ? {
            loyersPercus: Math.round(realYear.breakdown.loyersPercus),
            revenusAutres: Math.round(realYear.breakdown.revenusAutres),
            depenses: Math.round(realYear.breakdown.depenses),
            credit: Math.round(realYear.breakdown.credit),
            cashFlow: Math.round(realYear.annualCF),
            monthsUsed: realYear.monthsUsed,
            isExtrapolated: realYear.isExtrapolated,
          }
        : null,
    });
  }

  const latestRealCF = latestReal?.annualCF ?? 0;
  const simRefYear = latestReal && latestReal.yearIdx < years
    ? (projection[latestReal.yearIdx]?.cashFlowAvantImpot ?? 0)
    : 0;
  const ecart = latestRealCF - simRefYear;

  return (
    <Card className="border-dotted">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base">Cash flow annuel</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggles : afficher / masquer chaque courbe */}
          <button
            type="button"
            onClick={() => setShowSimule((v) => !v)}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              showSimule
                ? "border-[#60a5fa]/50 bg-[#60a5fa]/10 text-[#60a5fa] font-medium"
                : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
            }`}
            title={showSimule ? "Masquer la courbe Simule" : "Afficher la courbe Simule"}
            aria-pressed={showSimule}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: showSimule ? "#60a5fa" : "transparent", border: "1px solid #60a5fa" }} />
            Simule
          </button>
          {hasOptimumDelta && (
            <button
              type="button"
              onClick={() => setShowOptimum((v) => !v)}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                showOptimum
                  ? "border-[#a855f7]/50 bg-[#a855f7]/10 text-[#a855f7] font-medium"
                  : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
              }`}
              title={showOptimum ? "Masquer la courbe Optimum" : "Afficher la courbe Optimum (sans vacance)"}
              aria-pressed={showOptimum}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: showOptimum ? "#a855f7" : "transparent", border: "1px solid #a855f7" }} />
              Optimum
            </button>
          )}
          {operating && (
            <button
              type="button"
              onClick={() => setShowReel((v) => !v)}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                showReel
                  ? "border-[#16a34a]/50 bg-[#16a34a]/10 text-[#16a34a] font-medium"
                  : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
              }`}
              title={showReel ? "Masquer la courbe Reel" : "Afficher la courbe Reel"}
              aria-pressed={showReel}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: showReel ? "#16a34a" : "transparent", border: "1px solid #16a34a" }} />
              Reel
            </button>
          )}
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
            title="Recharger la simulation depuis les donnees sauvegardees"
          >
            ↻ Recharger la simulation
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
          {operating && latestReal && (
            <>
              <span>
                CF reel A{latestReal.yearIdx + 1}{latestReal.isExtrapolated ? ` (extrapole sur ${latestReal.monthsUsed}m)` : ""} :{" "}
                <strong className={latestRealCF >= 0 ? "text-green-600" : "text-destructive"}>
                  {formatCurrency(latestRealCF)}
                </strong>
              </span>
              <span>
                Ecart :{" "}
                <strong className={ecart >= 0 ? "text-green-600" : "text-destructive"}>
                  {ecart >= 0 ? "+" : ""}{formatCurrency(ecart)}
                </strong>
              </span>
            </>
          )}
          <span>
            CF simule (A{latestReal ? latestReal.yearIdx + 1 : 1}) :{" "}
            <strong className="text-foreground">{formatCurrency(simRefYear)}</strong>
          </span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="annee" tick={{ fontSize: 10 }} />
            {/* Left axis — Simule (blue) */}
            <YAxis
              yAxisId="simule"
              orientation="left"
              tick={{ fontSize: 10, fill: "#60a5fa" }}
              stroke="#60a5fa"
              domain={["auto", "auto"]}
              allowDecimals={false}
              tickFormatter={(v: number) => {
                const abs = Math.abs(v);
                if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
                return `${v}`;
              }}
            />
            {/* Right axis — Reel (green), only when operating */}
            {operating && (
              <YAxis
                yAxisId="reel"
                orientation="right"
                tick={{ fontSize: 10, fill: "#16a34a" }}
                stroke="#16a34a"
                domain={["auto", "auto"]}
                allowDecimals={false}
                tickFormatter={(v: number) => {
                  const abs = Math.abs(v);
                  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
                  return `${v}`;
                }}
              />
            )}
            <Tooltip content={<BreakdownTooltip />} wrapperStyle={{ zIndex: 50 }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
            {showSimule && (
              <Line yAxisId="simule" type="monotone" dataKey="simule" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} name="Simule (avant impot)" />
            )}
            {hasOptimumDelta && showOptimum && (
              <Line yAxisId="simule" type="monotone" dataKey="optimum" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 1.5 }} name="Optimum (sans vacance)" connectNulls={false} />
            )}
            {operating && showReel && (
              <Line yAxisId="reel" type="monotone" dataKey="reel" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: "#16a34a" }} name="Reel (avant impot)" connectNulls={false} />
            )}
            <ReferenceLine yAxisId="simule" y={0} stroke="#999" strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <p className="text-[10px] text-muted-foreground leading-relaxed flex-1 min-w-0">
            Comparaison <strong>avant impot</strong> : meme convention des deux cotes.
            {operating ? (
              <>
                {" "}La courbe verte montre le cash flow reel annualise pour chaque annee d&apos;exploitation
                ({yearsOwned} annee{yearsOwned > 1 ? "s" : ""} de donnees).
                {latestReal?.isExtrapolated && ` L'annee en cours (A${yearsOwned}) est extrapolee sur ${latestReal.monthsUsed} mois.`}
              </>
            ) : (
              <>
                {" "}Le bien n&apos;est pas encore en location — la courbe reelle s&apos;affichera des
                que le bien sera passe en phase &quot;Mise en location&quot; ou &quot;Exploitation&quot;.
              </>
            )}
          </p>
          <RvsCurvesInfo />
        </div>

        {/* Snapshot de la simulation initiale : repliable, verrouillable, editable */}
        {snapshot && (
          <SimSnapshotBlock
            snapshot={snapshot}
            property={property}
            onUpdateProperty={onUpdateProperty}
          />
        )}
      </CardContent>
    </Card>
  );
}
