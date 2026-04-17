"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Depense, PaiementCharge, StatutPaiementCharge } from "@/types";
import { CATEGORIE_DEPENSE_LABELS, STATUT_PAIEMENT_CHARGE_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { obtenirMontantCourant } from "@/lib/revisionsDepenses";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  bienId: string;
  depenses: Depense[];
  /** Bien acquisition date — extends year range */
  dateSaisie?: string;
  entries: PaiementCharge[];
  onUpsert: (
    bienId: string,
    depenseId: string,
    periode: string,
    updates: Partial<Omit<PaiementCharge, "id" | "bienId" | "depenseId" | "periode" | "createdAt" | "updatedAt">>,
  ) => void;
  onDelete: (id: string) => void;
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juil", "Aout", "Sep", "Oct", "Nov", "Dec"];
const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"];

function statusColor(status: StatutPaiementCharge): { bg: string; border: string; text: string } {
  switch (status) {
    case "paye":
      return { bg: "bg-green-600/15", border: "border-green-600/40", text: "text-green-700" };
    case "partiel":
      return { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-700" };
    case "en_attente":
      return { bg: "bg-muted", border: "border-muted-foreground/20", text: "text-muted-foreground" };
  }
}

/** Build period keys for a given year + frequency */
function periodsForYear(year: number, frequence: string): string[] {
  if (frequence === "mensuel") {
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  }
  if (frequence === "trimestriel") {
    return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];
  }
  if (frequence === "annuel") {
    return [`${year}`];
  }
  return []; // ponctuel — not tracked periodically
}

function periodeLabel(periode: string): string {
  if (periode.includes("-Q")) {
    return periode.split("-")[1]; // "Q1"
  }
  if (periode.includes("-") && periode.length === 7) {
    const m = Number(periode.split("-")[1]);
    return MONTH_LABELS[m - 1] ?? periode;
  }
  return periode; // "2026"
}

/* ── Cell editor (portal) ── */

interface CellEditorProps {
  bienId: string;
  depenseId: string;
  periode: string;
  montantAttendu: number;
  entry: PaiementCharge | undefined;
  anchorRect: DOMRect;
  onUpsert: Props["onUpsert"];
  onDelete: Props["onDelete"];
  onClose: () => void;
}

function CellEditor({
  bienId, depenseId, periode, montantAttendu, entry, anchorRect, onUpsert, onDelete, onClose,
}: CellEditorProps) {
  const [statut, setStatut] = useState<StatutPaiementCharge>(entry?.statut ?? "paye");
  const [montantPaye, setMontantPaye] = useState(String(entry?.montantPaye ?? montantAttendu));
  const [notes, setNotes] = useState(entry?.notes ?? "");

  const handleSave = () => {
    const paye = statut === "en_attente" ? 0 : Number(montantPaye) || 0;
    onUpsert(bienId, depenseId, periode, {
      statut,
      montantAttendu,
      montantPaye: paye,
      notes: notes || undefined,
    });
    onClose();
  };

  const handleClear = () => {
    if (entry) onDelete(entry.id);
    onClose();
  };

  const POP_WIDTH = 256;
  const POP_HEIGHT = 220;
  let top = anchorRect.bottom + 4;
  let left = anchorRect.left;
  if (left + POP_WIDTH > window.innerWidth - 8) left = window.innerWidth - POP_WIDTH - 8;
  if (left < 8) left = 8;
  if (top + POP_HEIGHT > window.innerHeight - 8) top = anchorRect.top - POP_HEIGHT - 4;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-64 border border-dotted rounded-lg bg-background shadow-lg p-3 space-y-2"
        style={{ top: `${top}px`, left: `${left}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">{periodeLabel(periode)}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary text-sm leading-none">×</button>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Statut</label>
          <div className="flex gap-1 mt-1">
            {(["paye", "partiel", "en_attente"] as StatutPaiementCharge[]).map((s) => {
              const c = statusColor(s);
              const active = statut === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatut(s)}
                  className={`text-[11px] px-2 py-1 rounded border transition-colors flex-1 ${
                    active ? `${c.bg} ${c.border} ${c.text} font-semibold` : "border-dotted border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {STATUT_PAIEMENT_CHARGE_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>

        {(statut === "paye" || statut === "partiel") && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Montant paye (attendu : {formatCurrency(montantAttendu)})
            </label>
            <Input
              type="number"
              value={montantPaye}
              onChange={(e) => setMontantPaye(e.target.value)}
              className="mt-1 h-8 text-xs"
            />
          </div>
        )}

        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel" className="mt-1 h-8 text-xs" />
        </div>

        <div className="flex gap-1.5 pt-1">
          <Button size="sm" onClick={handleSave} className="flex-1 text-[11px] h-7">Enregistrer</Button>
          {entry && (
            <Button size="sm" variant="outline" onClick={handleClear} className="text-[11px] h-7">Effacer</Button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ── Single cell ── */

function Cell({
  bienId, depenseId, periode, montantAttendu, entry, onUpsert, onDelete, colSpan,
}: {
  bienId: string;
  depenseId: string;
  periode: string;
  montantAttendu: number;
  entry: PaiementCharge | undefined;
  onUpsert: Props["onUpsert"];
  onDelete: Props["onDelete"];
  colSpan?: number;
}) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!anchorRect) return;
    const close = () => setAnchorRect(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchorRect]);

  const colors = entry ? statusColor(entry.statut) : null;
  const display = entry
    ? entry.statut === "en_attente"
      ? STATUT_PAIEMENT_CHARGE_LABELS.en_attente
      : formatCurrency(entry.montantPaye)
    : "—";

  const handleClick = () => {
    if (anchorRect) setAnchorRect(null);
    else if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
  };

  return (
    <td className="border border-dashed border-muted-foreground/10 p-0" colSpan={colSpan}>
      <button
        ref={btnRef}
        onClick={handleClick}
        className={`h-10 w-full flex items-center justify-center text-[10px] font-medium tabular-nums transition-colors ${
          entry
            ? `${colors!.bg} ${colors!.text} hover:opacity-80`
            : "hover:bg-muted/40 text-muted-foreground/50"
        }`}
        title={entry?.notes || display}
      >
        {display}
      </button>
      {anchorRect && (
        <CellEditor
          bienId={bienId}
          depenseId={depenseId}
          periode={periode}
          montantAttendu={montantAttendu}
          entry={entry}
          anchorRect={anchorRect}
          onUpsert={onUpsert}
          onDelete={onDelete}
          onClose={() => setAnchorRect(null)}
        />
      )}
    </td>
  );
}

/* ── Main grid ── */

export function GrilleSuiviCharges({ bienId, depenses, entries, onUpsert, onDelete, dateSaisie }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Only recurring (non-ponctuel, non-credit) depenses
  const recurringExpenses = useMemo(
    () => depenses.filter((e) => e.frequence !== "ponctuel" && e.categorie !== "credit"),
    [depenses],
  );

  // Year options: from acquisition year to current year
  const years = useMemo(() => {
    const ys = new Set<number>();
    ys.add(currentYear);
    // Include all years from acquisition
    if (dateSaisie) {
      const achatYear = parseInt(dateSaisie.slice(0, 4));
      if (!isNaN(achatYear)) {
        for (let y = achatYear; y <= currentYear; y++) ys.add(y);
      }
    }
    for (const e of depenses) {
      const y = new Date(e.dateDebut).getFullYear();
      if (!isNaN(y) && y >= 2000) ys.add(y);
    }
    ys.add(currentYear + 1); // always show n+1 (greyed out until it becomes current)
    return Array.from(ys).sort((a, b) => a - b);
  }, [depenses, currentYear, dateSaisie]);

  // KPIs
  const kpis = useMemo(() => {
    let totalAttendu = 0;
    let totalPaye = 0;
    let missingCount = 0;

    // Determine which periods are "in the past" so we can flag missing entries.
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1; // 1-12
    const curQuarter = Math.ceil(curMonth / 3);
    const isPast = (periode: string): boolean => {
      if (selectedYear < curYear) return true;
      if (selectedYear > curYear) return false;
      // Same year — check period granularity
      if (periode.includes("-Q")) {
        const q = Number(periode.split("-Q")[1]);
        return q < curQuarter;
      }
      if (periode.includes("-") && periode.length === 7) {
        const m = Number(periode.split("-")[1]);
        return m < curMonth;
      }
      // Annual period: considered past only if we're past the year
      return false;
    };

    for (const exp of recurringExpenses) {
      const periods = periodsForYear(selectedYear, exp.frequence);
      const montant = obtenirMontantCourant(exp);
      for (const p of periods) {
        totalAttendu += montant;
        const entry = entries.find((e) => e.depenseId === exp.id && e.periode === p);
        if (entry) {
          totalPaye += entry.montantPaye;
        } else if (isPast(p)) {
          missingCount++;
        }
      }
    }
    const couverture = totalAttendu > 0 ? (totalPaye / totalAttendu) * 100 : 0;
    const hasGaps = missingCount > 0;
    return { totalAttendu, totalPaye, ecart: totalAttendu - totalPaye, couverture, hasGaps, missingCount };
  }, [recurringExpenses, entries, selectedYear]);

  if (recurringExpenses.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Aucune depense recurrente a suivre.</p>;
  }

  // Column headers (12 months — all depenses share the same header grid)
  const monthHeaders = Array.from({ length: 12 }, (_, i) => MONTH_LABELS[i]);

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="border border-dotted rounded-md p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total attendu</p>
          <p className="text-sm font-bold text-muted-foreground">{formatCurrency(kpis.totalAttendu)}</p>
        </div>
        <div className="border border-dotted rounded-md p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total paye</p>
          <p className="text-sm font-bold">{formatCurrency(kpis.totalPaye)}</p>
        </div>
        {(() => {
          const ecartPct = kpis.totalAttendu > 0 ? (kpis.ecart / kpis.totalAttendu) * 100 : 0;
          let color = "";
          let tooltip = "";
          if (ecartPct > 0 && ecartPct <= 2) {
            color = "text-green-600";
            tooltip = `Charges inferieures aux previsions de ${ecartPct.toFixed(1)}% (< 2%) — bonne maitrise des couts`;
          } else if (ecartPct > 2) {
            tooltip = `Charges inferieures de ${ecartPct.toFixed(1)}% (> 2%) — ecart important, verifier s'il ne manque pas des paiements`;
          } else if (ecartPct < -1) {
            color = "text-destructive";
            tooltip = `Depassement de ${Math.abs(ecartPct).toFixed(1)}% (> 1%) — charges superieures aux previsions`;
          } else if (ecartPct < 0) {
            tooltip = `Leger depassement de ${Math.abs(ecartPct).toFixed(1)}% (< 1%) — dans la tolerance`;
          } else {
            tooltip = "Charges conformes aux previsions";
          }
          return (
            <div className="border border-dotted rounded-md p-2" title={tooltip}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ecart</p>
              <p className={`text-sm font-bold ${color}`}>
                {formatCurrency(kpis.ecart)}
              </p>
            </div>
          );
        })()}
        <div className="border border-dotted rounded-md p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Couverture</p>
          <p className={`text-sm font-bold ${kpis.hasGaps ? "text-amber-600" : ""}`}>
            {kpis.couverture.toFixed(0)} %
            {kpis.hasGaps && (
              <span className="text-[9px] font-normal ml-1" title={`${kpis.missingCount} periode(s) passee(s) sans saisie`}>
                (donnees manquantes)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Annee :</span>
        {years.map((y) => {
          const isFuture = y > currentYear;
          return (
            <button
              key={y}
              onClick={() => !isFuture && setSelectedYear(y)}
              disabled={isFuture}
              className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                isFuture
                  ? "border-dotted border-muted-foreground/15 text-muted-foreground/40 cursor-not-allowed"
                  : selectedYear === y
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}{y === currentYear ? " (courante)" : ""}{isFuture ? " (a venir)" : ""}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto border border-dotted rounded-lg">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/20">
              <th className="text-left py-2 pl-3 pr-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium min-w-[160px] sticky left-0 bg-muted/20 z-10">
                Charge
              </th>
              {monthHeaders.map((label) => (
                <th key={label} className="py-2 px-1 text-[10px] text-muted-foreground font-medium min-w-[56px]">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recurringExpenses.map((exp) => {
              const montant = obtenirMontantCourant(exp);
              const periods = periodsForYear(selectedYear, exp.frequence);

              if (exp.frequence === "mensuel") {
                return (
                  <tr key={exp.id}>
                    <td className="py-2 pl-3 pr-2 text-xs font-medium border-r border-dashed border-muted-foreground/10 sticky left-0 bg-background z-10">
                      <div className="truncate max-w-[160px]">{exp.label}</div>
                      <div className="text-[9px] text-muted-foreground">{CATEGORIE_DEPENSE_LABELS[exp.categorie]} · {formatCurrency(montant)}/mois</div>
                    </td>
                    {periods.map((p) => {
                      const entry = entries.find((e) => e.depenseId === exp.id && e.periode === p);
                      return (
                        <Cell
                          key={p}
                          bienId={bienId}
                          depenseId={exp.id}
                          periode={p}
                          montantAttendu={montant}
                          entry={entry}
                          onUpsert={onUpsert}
                          onDelete={onDelete}
                        />
                      );
                    })}
                  </tr>
                );
              }

              if (exp.frequence === "trimestriel") {
                return (
                  <tr key={exp.id}>
                    <td className="py-2 pl-3 pr-2 text-xs font-medium border-r border-dashed border-muted-foreground/10 sticky left-0 bg-background z-10">
                      <div className="truncate max-w-[160px]">{exp.label}</div>
                      <div className="text-[9px] text-muted-foreground">{CATEGORIE_DEPENSE_LABELS[exp.categorie]} · {formatCurrency(montant)}/trim.</div>
                    </td>
                    {QUARTER_LABELS.map((q, qi) => {
                      const p = `${selectedYear}-${q}`;
                      const entry = entries.find((e) => e.depenseId === exp.id && e.periode === p);
                      return (
                        <Cell
                          key={p}
                          bienId={bienId}
                          depenseId={exp.id}
                          periode={p}
                          montantAttendu={montant}
                          entry={entry}
                          onUpsert={onUpsert}
                          onDelete={onDelete}
                          colSpan={3}
                        />
                      );
                    })}
                  </tr>
                );
              }

              if (exp.frequence === "annuel") {
                const p = `${selectedYear}`;
                const entry = entries.find((e) => e.depenseId === exp.id && e.periode === p);
                return (
                  <tr key={exp.id}>
                    <td className="py-2 pl-3 pr-2 text-xs font-medium border-r border-dashed border-muted-foreground/10 sticky left-0 bg-background z-10">
                      <div className="truncate max-w-[160px]">{exp.label}</div>
                      <div className="text-[9px] text-muted-foreground">{CATEGORIE_DEPENSE_LABELS[exp.categorie]} · {formatCurrency(montant)}/an</div>
                    </td>
                    <Cell
                      bienId={bienId}
                      depenseId={exp.id}
                      periode={p}
                      montantAttendu={montant}
                      entry={entry}
                      onUpsert={onUpsert}
                      onDelete={onDelete}
                      colSpan={12}
                    />
                  </tr>
                );
              }

              return null;
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {(["paye", "partiel", "en_attente"] as StatutPaiementCharge[]).map((s) => {
          const c = statusColor(s);
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-sm ${c.bg} ${c.border} border`} />
              <span>{STATUT_PAIEMENT_CHARGE_LABELS[s]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
