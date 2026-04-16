"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Lot, SuiviMensuelLoyer, StatutSuiviMensuelLoyer, PartielRaison } from "@/types";
import { STATUT_SUIVI_MENSUEL_LOYER_LABELS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  propertyId: string;
  lots: Lot[];
  entries: SuiviMensuelLoyer[];
  /** Date d'acquisition / exploitation (YYYY-MM-DD). Cells before this month are locked. */
  dateExploitation?: string;
  onUpsert: (
    propertyId: string,
    lotId: string,
    yearMonth: string,
    updates: Partial<Omit<SuiviMensuelLoyer, "id" | "propertyId" | "lotId" | "yearMonth" | "createdAt" | "updatedAt">>,
  ) => void;
  onDelete: (id: string) => void;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aout", "Sep", "Oct", "Nov", "Dec",
];

function monthsRange(minYM: string, maxYM: string): string[] {
  const [sy, sm] = minYM.split("-").map(Number);
  const [ey, em] = maxYM.split("-").map(Number);
  const months: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function parseMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-");
  return { year: Number(y), month: Number(m) };
}

/** YYYY-MM for a Date in local time */
function toYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Compute the editable range for rent tracking:
 * - minYM: dateExploitation month (or M-12 fallback if not set)
 * - maxYM: M+1 (next month)
 */
function editableRange(dateExploitation?: string): { minYM: string; maxYM: string } {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const maxYM = toYM(nextMonth);
  // Use acquisition date as start, fallback to M-12
  if (dateExploitation) {
    const expl = new Date(dateExploitation);
    if (!isNaN(expl.getTime())) {
      return { minYM: toYM(expl), maxYM };
    }
  }
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  return { minYM: toYM(twelveMonthsAgo), maxYM };
}

function statusColor(status: StatutSuiviMensuelLoyer): { bg: string; border: string; text: string } {
  switch (status) {
    case "paye":
      return { bg: "bg-green-600/15", border: "border-green-600/40", text: "text-green-700" };
    case "partiel":
      return { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-700" };
    case "impaye":
      return { bg: "bg-destructive/15", border: "border-destructive/40", text: "text-destructive" };
    case "vacant":
      return { bg: "bg-muted", border: "border-muted-foreground/20", text: "text-muted-foreground" };
    case "travaux":
      return { bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-700" };
  }
}

interface CellEditorProps {
  propertyId: string;
  lotId: string;
  yearMonth: string;
  loyerAttendu: number;
  entry: SuiviMensuelLoyer | undefined;
  anchorRect: DOMRect;
  onUpsert: Props["onUpsert"];
  onDelete: Props["onDelete"];
  onClose: () => void;
}

function CellEditor({
  propertyId,
  lotId,
  yearMonth,
  loyerAttendu,
  entry,
  anchorRect,
  onUpsert,
  onDelete,
  onClose,
}: CellEditorProps) {
  const [statut, setStatut] = useState<StatutSuiviMensuelLoyer>(entry?.statut ?? "paye");
  const [partielRaison, setPartielRaison] = useState<PartielRaison>(entry?.partielRaison ?? "impaye");
  const [loyerPercu, setLoyerPercu] = useState<string>(
    String(entry?.loyerPercu ?? loyerAttendu),
  );
  const [notes, setNotes] = useState(entry?.notes ?? "");

  const handleSave = () => {
    const percu = statut === "vacant" || statut === "impaye" || statut === "travaux" ? 0 : Number(loyerPercu) || 0;
    onUpsert(propertyId, lotId, yearMonth, {
      statut,
      loyerAttendu,
      loyerPercu: percu,
      partielRaison: statut === "partiel" ? partielRaison : undefined,
      notes: notes || undefined,
    });
    onClose();
  };

  const handleClear = () => {
    if (entry) onDelete(entry.id);
    onClose();
  };

  const { year, month } = parseMonth(yearMonth);

  // Position the popover below the anchor cell, clamped within the viewport
  const POP_WIDTH = 256;
  const POP_HEIGHT = 260; // estimated
  let top = anchorRect.bottom + 4;
  let left = anchorRect.left;
  if (left + POP_WIDTH > window.innerWidth - 8) {
    left = window.innerWidth - POP_WIDTH - 8;
  }
  if (left < 8) left = 8;
  if (top + POP_HEIGHT > window.innerHeight - 8) {
    top = anchorRect.top - POP_HEIGHT - 4;
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-64 border border-dotted rounded-lg bg-background shadow-lg p-3 space-y-2"
        style={{ top: `${top}px`, left: `${left}px` }}
        onClick={(e) => e.stopPropagation()}
      >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">
          {MONTH_LABELS[month - 1]} {year}
        </p>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-primary text-sm leading-none"
        >
          ×
        </button>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Statut</label>
        <div className="grid grid-cols-2 gap-1 mt-1">
          {(["paye", "partiel", "impaye", "vacant", "travaux"] as StatutSuiviMensuelLoyer[]).map((s) => {
            const c = statusColor(s);
            const active = statut === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatut(s)}
                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                  active ? `${c.bg} ${c.border} ${c.text} font-semibold` : "border-dotted border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {STATUT_SUIVI_MENSUEL_LOYER_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {(statut === "paye" || statut === "partiel") && (
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Loyer percu (attendu : {formatCurrency(loyerAttendu)})
          </label>
          <Input
            type="number"
            value={loyerPercu}
            onChange={(e) => setLoyerPercu(e.target.value)}
            className="mt-1 h-8 text-xs"
          />
        </div>
      )}

      {statut === "partiel" && (() => {
        const percu = Number(loyerPercu) || 0;
        const prorata = loyerAttendu > 0 ? Math.round((percu / loyerAttendu) * 100) : 0;
        const joursOccupes = loyerAttendu > 0 ? Math.round((percu / loyerAttendu) * 30) : 0;
        return (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Raison</label>
            <div className="flex flex-col gap-1.5 mt-1">
              <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                <input
                  type="radio"
                  name="partielRaison"
                  checked={partielRaison === "impaye"}
                  onChange={() => setPartielRaison("impaye")}
                  className="accent-primary"
                />
                <span className={partielRaison === "impaye" ? "text-foreground font-medium" : "text-muted-foreground"}>Impaye partiel</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                <input
                  type="radio"
                  name="partielRaison"
                  checked={partielRaison === "vacance_partielle"}
                  onChange={() => setPartielRaison("vacance_partielle")}
                  className="accent-primary"
                />
                <span className={partielRaison === "vacance_partielle" ? "text-foreground font-medium" : "text-muted-foreground"}>Vacance partielle du mois</span>
              </label>
            </div>
            {partielRaison === "vacance_partielle" && loyerAttendu > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                Occupation : ~{joursOccupes}j/30 ({prorata}%) — taux d&apos;occupation ajuste au prorata
              </p>
            )}
          </div>
        );
      })()}

      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optionnel"
          className="mt-1 h-8 text-xs"
        />
      </div>

      <div className="flex gap-1.5 pt-1">
        <Button size="sm" onClick={handleSave} className="flex-1 text-[11px] h-7">
          Enregistrer
        </Button>
        {entry && (
          <Button size="sm" variant="outline" onClick={handleClear} className="text-[11px] h-7">
            Effacer
          </Button>
        )}
      </div>
      </div>
    </>,
    document.body,
  );
}

interface CellProps {
  propertyId: string;
  lot: Lot;
  yearMonth: string;
  entry: SuiviMensuelLoyer | undefined;
  isLocked: boolean;
  onUpsert: Props["onUpsert"];
  onDelete: Props["onDelete"];
}

function Cell({ propertyId, lot, yearMonth, entry, isLocked, onUpsert, onDelete }: CellProps) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close when scrolling/resizing (position would be stale)
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

  if (isLocked) {
    return (
      <td className="border border-dashed border-muted-foreground/10 p-0">
        <div className="h-10 w-full bg-muted/20" />
      </td>
    );
  }

  const colors = entry ? statusColor(entry.statut) : null;
  const display = entry
    ? entry.statut === "paye" || entry.statut === "partiel"
      ? formatCurrency(entry.loyerPercu)
      : STATUT_SUIVI_MENSUEL_LOYER_LABELS[entry.statut]
    : "—";

  const handleClick = () => {
    if (anchorRect) {
      setAnchorRect(null);
    } else if (btnRef.current) {
      setAnchorRect(btnRef.current.getBoundingClientRect());
    }
  };

  return (
    <td className="border border-dashed border-muted-foreground/10 p-0">
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
          propertyId={propertyId}
          lotId={lot.id}
          yearMonth={yearMonth}
          loyerAttendu={lot.loyerMensuel}
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

export function RentTrackingGrid({ propertyId, lots, entries, dateExploitation, onUpsert, onDelete }: Props) {
  const now = new Date();
  const currentYM = toYM(now);
  const { minYM, maxYM } = editableRange(dateExploitation);
  const allMonths = monthsRange(minYM, maxYM);

  // Year-based navigation
  const availableYears = Array.from(
    new Set(allMonths.map(m => Number(m.split("-")[0])))
  ).sort((a, b) => a - b);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const months = allMonths.filter(m => m.startsWith(String(selectedYear)));

  // Compute KPIs across displayed window — excluding future months (beyond current month)
  const kpis = (() => {
    const pastMonths = months.filter((m) => m <= currentYM);
    const windowEntries = entries.filter((e) => pastMonths.includes(e.yearMonth));
    const loyerMensuel = lots.reduce((s, l) => s + l.loyerMensuel, 0);
    const totalAttendu = loyerMensuel * 12;
    const totalPercu = windowEntries.reduce((s, e) => s + e.loyerPercu, 0);

    // Impayes: only count actual non-payment, NOT vacance partielle
    const totalImpayes = windowEntries
      .filter((e) => e.statut === "impaye" || (e.statut === "partiel" && e.partielRaison !== "vacance_partielle"))
      .reduce((s, e) => s + Math.max(0, e.loyerAttendu - e.loyerPercu), 0);

    // Taux d'occupation:
    // - Full vacant/travaux = 0% for that lot-month
    // - Vacance partielle = prorata (loyerPercu / loyerAttendu)
    // - Everything else (paye, partiel impaye, unrecorded) = 100%
    const totalMoisLots = lots.length * pastMonths.length;
    let occupationUnits = totalMoisLots; // start assuming full occupation
    for (const e of windowEntries) {
      if (e.statut === "vacant" || e.statut === "travaux") {
        occupationUnits -= 1; // fully vacant
      } else if (e.statut === "partiel" && e.partielRaison === "vacance_partielle" && e.loyerAttendu > 0) {
        occupationUnits -= (1 - e.loyerPercu / e.loyerAttendu); // prorata vacancy
      }
    }
    const tauxOccupation = totalMoisLots > 0 ? (occupationUnits / totalMoisLots) * 100 : 0;

    // Detect past lot-months with no tracking entry — if data is missing the
    // taux above is unreliable (defaulting unrecorded months to "occupied").
    const entryKeys = new Set(windowEntries.map((e) => `${e.lotId}:${e.yearMonth}`));
    let missingCount = 0;
    for (const lot of lots) {
      for (const ym of pastMonths) {
        if (!entryKeys.has(`${lot.id}:${ym}`)) missingCount++;
      }
    }
    const hasGaps = missingCount > 0;

    // Attendu to date: for current year = Jan→now, for past years = full year
    const nowDate = new Date();
    const currentYear = nowDate.getFullYear();
    const currentMonth = nowDate.getMonth() + 1; // 1-12
    const selYear = Number(months[0]?.split("-")[0]) || currentYear;
    const moisToDate = selYear === currentYear ? currentMonth : (selYear < currentYear ? 12 : 0);
    const attenduToDate = loyerMensuel * moisToDate;

    return { totalAttendu, attenduToDate, moisToDate, totalPercu, totalImpayes, tauxOccupation, nbMois: pastMonths.length, hasGaps, missingCount };
  })();

  if (lots.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="border border-dotted rounded-md p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Taux occupation</p>
          <p className={`text-sm font-bold ${kpis.hasGaps ? "text-amber-600" : ""}`}>
            {kpis.tauxOccupation.toFixed(0)} %
            {kpis.hasGaps && (
              <span className="text-[9px] font-normal ml-1" title={`${kpis.missingCount} mois-lot sans saisie`}>
                (donnees manquantes)
              </span>
            )}
          </p>
        </div>
        <div className="border border-dotted rounded-md p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Loyer percu ({selectedYear})
          </p>
          <p className="text-sm font-bold">{formatCurrency(kpis.totalPercu)}</p>
        </div>
        <div className="border border-dotted rounded-md p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Attendu a ce jour ({kpis.moisToDate}m)
          </p>
          <p className="text-sm font-bold">{formatCurrency(kpis.attenduToDate)}</p>
          <p className="text-[9px] text-muted-foreground">Annee complete : {formatCurrency(kpis.totalAttendu)}</p>
        </div>
        <div className="border border-dotted rounded-md p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impayes</p>
          <p className={`text-sm font-bold ${kpis.totalImpayes > 0 ? "text-destructive" : ""}`}>
            {formatCurrency(kpis.totalImpayes)}
          </p>
        </div>
      </div>

      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                selectedYear === y
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">Cliquer une cellule pour editer</p>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto border border-dotted rounded-lg">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/20">
              <th className="text-left py-2 pl-3 pr-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium min-w-[120px] sticky left-0 bg-muted/20 z-10">
                Lot
              </th>
              {months.map((ym) => {
                const { year, month } = parseMonth(ym);
                return (
                  <th
                    key={ym}
                    className="py-2 px-1 text-[10px] text-muted-foreground font-medium min-w-[56px]"
                  >
                    <div className="font-semibold">{MONTH_LABELS[month - 1]}</div>
                    <div className="opacity-60 text-[9px]">{String(year).slice(2)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id}>
                <td className="py-2 pl-3 pr-2 text-xs font-medium border-r border-dashed border-muted-foreground/10 sticky left-0 bg-background z-10">
                  <div className="truncate max-w-[120px]">{lot.nom}</div>
                  <div className="text-[9px] text-muted-foreground">
                    {formatCurrency(lot.loyerMensuel)}/mois
                  </div>
                </td>
                {months.map((ym) => {
                  const entry = entries.find((e) => e.lotId === lot.id && e.yearMonth === ym);
                  const isLocked = ym < minYM || ym > maxYM;
                  return (
                    <Cell
                      key={ym}
                      propertyId={propertyId}
                      lot={lot}
                      yearMonth={ym}
                      entry={entry}
                      isLocked={isLocked}
                      onUpsert={onUpsert}
                      onDelete={onDelete}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {(["paye", "partiel", "impaye", "vacant", "travaux"] as StatutSuiviMensuelLoyer[]).map((s) => {
          const c = statusColor(s);
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-sm ${c.bg} ${c.border} border`} />
              <span>{STATUT_SUIVI_MENSUEL_LOYER_LABELS[s]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
