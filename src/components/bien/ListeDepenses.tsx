"use client";

import { useMemo, useState } from "react";
import type { Depense, FrequenceDepense, RevisionDepense } from "@/types";
import { CATEGORIE_DEPENSE_LABELS, FREQUENCY_LABELS, DEPENSE_GROUPS } from "@/types";
import { formatCurrency, annualiserMontant } from "@/lib/utils";
import { getMontantForYear, getRevisionTimeline } from "@/lib/revisionsDepenses";
import { ExpenseEvolutionTable } from "./ExpenseEvolutionTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ExpenseListProps {
  expenses: Depense[];
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Depense>) => void;
  /**
   * When true, color each Montant cell based on `priceValidated`:
   * green = confirmed by contract, amber = still a projection.
   * Used in pre-acte properties; defaults to false (neutral colors) post-acte.
   */
  colorByValidation?: boolean;
}

function EditableCell({
  value,
  type = "text",
  onSave,
  className,
}: {
  value: string | number;
  type?: "text" | "number";
  onSave: (v: string | number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors ${className ?? ""}`}
        onClick={() => { setDraft(String(value)); setEditing(true); }}
      >
        {type === "number" ? formatCurrency(Number(value)) : value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = type === "number" ? Number(draft) || 0 : draft;
        if (v !== value) onSave(v);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-full h-6 px-1 text-sm border border-input rounded bg-transparent outline-none focus:border-ring"
      step={type === "number" ? "0.01" : undefined}
    />
  );
}

function FrequencyChips({
  value,
  onChange,
}: {
  value: FrequenceDepense;
  onChange: (v: FrequenceDepense) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <span
        className="cursor-pointer hover:bg-primary/10 rounded px-1 -mx-1 transition-colors"
        onClick={() => setOpen(true)}
      >
        {FREQUENCY_LABELS[value]}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(FREQUENCY_LABELS).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => { onChange(k as FrequenceDepense); setOpen(false); }}
          className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
            value === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  credit: "🏦",
  taxe_fonciere: "🏛",
  assurance_pno: "🛡",
  gestion_locative: "🔑",
  copropriete: "🏢",
  reparations: "🔧",
  charges_locatives: "💡",
  vacance: "🚪",
  frais_notaire: "⚖",
  travaux: "🏗",
  ameublement: "🪑",
  autre: "📌",
};

/* ── Reviser dialog ── */

interface ReviseDialogProps {
  expense: Depense;
  selectedYear: number;
  onClose: () => void;
  onSave: (revision: Omit<RevisionDepense, "id">) => void;
  onDeleteRevision: (revisionId: string) => void;
}

function ReviseDialog({ expense, selectedYear, onClose, onSave, onDeleteRevision }: ReviseDialogProps) {
  const timeline = getRevisionTimeline(expense);
  const [montant, setMontant] = useState(String(getMontantForYear(expense, selectedYear)));
  const [dateEffet, setDateEffet] = useState(`${selectedYear}-01-01`);
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    const v = Number(montant);
    if (isNaN(v) || v <= 0) return;
    onSave({ dateEffet, montant: v, notes: notes || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative border border-dotted rounded-lg p-5 bg-background shadow-lg w-full max-w-md mx-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Reviser le prix</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {expense.label} · {CATEGORIE_DEPENSE_LABELS[expense.categorie]}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-primary text-lg leading-none">×</button>
        </div>

        {/* History */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Historique</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {timeline.map((entry, idx) => {
              const prev = timeline[idx + 1];
              const delta = prev ? entry.montant - prev.montant : 0;
              const deltaPct = prev && prev.montant > 0 ? (delta / prev.montant) * 100 : 0;
              return (
                <div
                  key={`${entry.dateEffet}-${idx}`}
                  className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                    entry.isInitial ? "bg-muted/30" : "border border-dotted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[11px] tabular-nums">{entry.dateEffet}</span>
                    {entry.isInitial && (
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">initial</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatCurrency(entry.montant)}</span>
                    {delta !== 0 && !entry.isInitial && (
                      <span className={`text-[10px] tabular-nums ${delta > 0 ? "text-destructive" : "text-green-600"}`}>
                        {delta > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
                      </span>
                    )}
                    {entry.id && (
                      <button
                        onClick={() => onDeleteRevision(entry.id!)}
                        className="text-destructive/40 hover:text-destructive text-sm leading-none"
                        title="Supprimer cette revision"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <hr className="border-dashed border-muted-foreground/20" />

        {/* New revision form */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nouvelle revision</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Montant</label>
              <Input
                type="number"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className="h-8 text-xs"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Date d&apos;effet</label>
              <Input
                type="date"
                value={dateEffet}
                onChange={(e) => setDateEffet(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Note (optionnel)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex: revision tacite, sinistre..."
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onClose} className="flex-1 text-xs">Annuler</Button>
          <Button size="sm" onClick={handleSave} className="flex-1 text-xs">Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}

/* ── Year selector ── */

function YearSelector({
  years,
  selected,
  onSelect,
}: {
  years: number[];
  selected: number;
  onSelect: (y: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Annee :</span>
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onSelect(y)}
          className={`text-[11px] px-2 py-1 rounded border transition-colors ${
            selected === y
              ? "border-primary/40 bg-primary/10 text-primary font-semibold"
              : "border-dotted border-muted-foreground/30 text-muted-foreground hover:text-foreground"
          }`}
        >
          {y}
          {y === currentYear && <span className="opacity-60 ml-1 text-[9px]">(courante)</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Main list ── */

export function ListeDepenses({ expenses, onDelete, onUpdate, colorByValidation }: ExpenseListProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [reviseTarget, setReviseTarget] = useState<Depense | null>(null);
  const [showEvolution, setShowEvolution] = useState(false);

  // Build year options based on expense history
  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const e of expenses) {
      const startYear = new Date(e.dateDebut).getFullYear();
      if (!isNaN(startYear)) ys.add(startYear);
      for (const r of e.revisions ?? []) {
        const ry = new Date(r.dateEffet).getFullYear();
        if (!isNaN(ry)) ys.add(ry);
      }
    }
    ys.add(currentYear);
    return Array.from(ys).sort((a, b) => a - b);
  }, [expenses, currentYear]);

  if (expenses.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Aucune depense enregistree.</p>;
  }

  const handleAddRevision = (expenseId: string, revision: Omit<RevisionDepense, "id">) => {
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense || !onUpdate) return;
    const newRevision: RevisionDepense = { ...revision, id: crypto.randomUUID() };
    onUpdate(expenseId, { revisions: [...(expense.revisions ?? []), newRevision] });
  };

  const handleDeleteRevision = (expenseId: string, revisionId: string) => {
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense || !onUpdate) return;
    onUpdate(expenseId, { revisions: (expense.revisions ?? []).filter((r) => r.id !== revisionId) });
  };

  return (
    <div className="space-y-4">
      {years.length > 1 && (
        <YearSelector years={years} selected={selectedYear} onSelect={setSelectedYear} />
      )}

      {Object.entries(DEPENSE_GROUPS).map(([groupLabel, categories]) => {
        const groupExpenses = expenses.filter((e) => categories.includes(e.categorie));
        if (groupExpenses.length === 0) return null;

        return (
          <div key={groupLabel}>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{groupLabel}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead className="text-right">Montant {selectedYear}</TableHead>
                  <TableHead>Frequence</TableHead>
                  <TableHead className="text-right">Annualise</TableHead>
                  <TableHead className="text-center" title="Cocher si un contrat / une offre confirme ce prix">Contrat</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupExpenses.map((expense) => {
                  const montantEffectif = getMontantForYear(expense, selectedYear);
                  const nbRevisions = (expense.revisions ?? []).length;
                  const hasDelta = montantEffectif !== expense.montant;
                  const validated = !!expense.priceValidated;
                  const montantColor = colorByValidation
                    ? validated ? "text-green-600" : "text-amber-600"
                    : "";
                  // Credit expense is auto-managed by the loan — block all edits here.
                  const isCredit = expense.categorie === "credit";
                  return (
                    <TableRow key={expense.id} className={isCredit ? "opacity-70" : ""}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-xs">{CATEGORY_ICONS[expense.categorie] ?? "📌"}</span>
                          {onUpdate && !isCredit ? (
                            <EditableCell
                              value={expense.label}
                              onSave={(v) => onUpdate(expense.id, { label: String(v) })}
                            />
                          ) : (
                            <span>{expense.label}{isCredit && <span className="text-[9px] text-muted-foreground ml-1">(via credit)</span>}</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{CATEGORIE_DEPENSE_LABELS[expense.categorie]}</TableCell>
                      <TableCell className={`text-right ${montantColor}`}>
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          {formatCurrency(montantEffectif)}
                          {nbRevisions > 0 && (
                            <span
                              className={`text-[9px] px-1 rounded ${hasDelta ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground"}`}
                              title={`${nbRevisions} revision${nbRevisions > 1 ? "s" : ""}`}
                            >
                              {nbRevisions}×
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {onUpdate && !isCredit ? (
                          <FrequencyChips
                            value={expense.frequence}
                            onChange={(v) => onUpdate(expense.id, { frequence: v })}
                          />
                        ) : FREQUENCY_LABELS[expense.frequence]}
                      </TableCell>
                      <TableCell className="text-right">
                        {expense.frequence !== "ponctuel"
                          ? formatCurrency(annualiserMontant(montantEffectif, expense.frequence))
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {!isCredit && (
                          <input
                            type="checkbox"
                            checked={!!expense.priceValidated}
                            disabled={!onUpdate}
                            onChange={(e) => onUpdate?.(expense.id, { priceValidated: e.target.checked })}
                            className="accent-primary cursor-pointer disabled:cursor-not-allowed"
                            title={expense.priceValidated ? "Prix confirme par contrat" : "Cocher si un contrat / une offre confirme ce prix"}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {!isCredit && (
                          <div className="flex items-center gap-0.5">
                            {onUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReviseTarget(expense)}
                                className="text-muted-foreground hover:text-primary px-2"
                                title="Reviser le prix"
                              >
                                ↻
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(expense.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              ×
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })}

      {/* Total mensuel */}
      {(() => {
        const totalMensuel = expenses
          .filter((e) => e.frequence !== "ponctuel")
          .reduce((s, e) => {
            const m = getMontantForYear(e, selectedYear);
            if (e.frequence === "mensuel") return s + m;
            if (e.frequence === "trimestriel") return s + m / 3;
            if (e.frequence === "annuel") return s + m / 12;
            return s;
          }, 0);
        const chargesMensuel = expenses
          .filter((e) => e.frequence !== "ponctuel" && e.categorie !== "credit")
          .reduce((s, e) => {
            const m = getMontantForYear(e, selectedYear);
            if (e.frequence === "mensuel") return s + m;
            if (e.frequence === "trimestriel") return s + m / 3;
            if (e.frequence === "annuel") return s + m / 12;
            return s;
          }, 0);
        const creditMensuel = totalMensuel - chargesMensuel;
        return (
          <div className="flex items-center justify-end gap-4 mt-3 pt-2 border-t border-dashed border-muted-foreground/15 text-xs text-muted-foreground">
            {creditMensuel > 0 && (
              <span>Charges : <strong className="text-foreground">{formatCurrency(chargesMensuel)}/m</strong></span>
            )}
            {creditMensuel > 0 && (
              <span>Credit : <strong className="text-foreground">{formatCurrency(creditMensuel)}/m</strong></span>
            )}
            <span>Total : <strong className="text-foreground">{formatCurrency(totalMensuel)}/m</strong></span>
          </div>
        );
      })()}

      {reviseTarget && onUpdate && (
        <ReviseDialog
          expense={reviseTarget}
          selectedYear={selectedYear}
          onClose={() => setReviseTarget(null)}
          onSave={(rev) => handleAddRevision(reviseTarget.id, rev)}
          onDeleteRevision={(rid) => handleDeleteRevision(reviseTarget.id, rid)}
        />
      )}

      {years.length > 1 && (
        <div className="mt-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowEvolution(!showEvolution)}
              className="text-xs text-primary hover:underline"
            >
              {showEvolution ? "Masquer" : "Evolution annee par annee"}
            </button>
          </div>
          {showEvolution && (
            <div className="mt-3">
              <ExpenseEvolutionTable expenses={expenses} years={years} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
