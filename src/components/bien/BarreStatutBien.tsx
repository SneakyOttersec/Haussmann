"use client";

import { useRef } from "react";
import type { StatutBien, StatutDocument } from "@/types";
import { STATUT_BIEN_LABELS, STATUT_BIEN_ORDER } from "@/types";
import { checkFileSize } from "@/lib/utils";
import { toast } from "sonner";

interface PropertyStatusBarProps {
  statut: StatutBien;
  statusDates?: Partial<Record<StatutBien, string>>;
  statusDocs?: Partial<Record<StatutBien, StatutDocument>>;
  onChange: (s: StatutBien) => void;
  onDateChange?: (s: StatutBien, date: string) => void;
  onDocChange?: (s: StatutBien, doc: StatutDocument | null) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function DocCell({ status, doc, isActive, onDocChange }: {
  status: StatutBien;
  doc: StatutDocument | undefined;
  isActive: boolean;
  onDocChange?: (s: StatutBien, doc: StatutDocument | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onDocChange) return;
    if (!checkFileSize(file)) return;
    const reader = new FileReader();
    reader.onload = () => {
      onDocChange(status, {
        nom: file.name,
        data: reader.result as string,
        type: file.type,
        taille: file.size,
      });
    };
    reader.readAsDataURL(file);
    // Reset so re-uploading the same file works
    e.target.value = "";
  };

  const handleDownload = () => {
    if (!doc) return;
    const a = document.createElement("a");
    a.href = doc.data;
    a.download = doc.nom;
    a.click();
  };

  if (!isActive) {
    return <span className="text-[9px] text-muted-foreground/30 select-none">—</span>;
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      {doc ? (
        <>
          <button
            type="button"
            onClick={handleDownload}
            title={`${doc.nom} (${formatSize(doc.taille)})`}
            className="text-[9px] text-primary truncate max-w-[80px] hover:underline"
          >
            {doc.nom}
          </button>
          <button
            type="button"
            onClick={() => onDocChange?.(status, null)}
            title="Retirer"
            className="text-[9px] text-destructive hover:opacity-70"
          >
            x
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title="Ajouter un document"
          className="text-[9px] text-muted-foreground hover:text-primary transition-colors"
        >
          + doc
        </button>
      )}
    </div>
  );
}

export function BarreStatutBien({ statut, statusDates, statusDocs, onChange, onDateChange, onDocChange }: PropertyStatusBarProps) {
  const currentIdx = STATUT_BIEN_ORDER.indexOf(statut);

  return (
    <div className="space-y-1">
      {/* Status buttons */}
      <div className="flex items-center gap-0.5">
        {STATUT_BIEN_ORDER.map((s, i) => {
          const isActive = i <= currentIdx;
          const isCurrent = s === statut;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`relative flex-1 py-1.5 text-[10px] text-center transition-colors rounded-sm ${
                isCurrent
                  ? "bg-primary text-primary-foreground font-bold"
                  : isActive
                  ? "bg-primary/20 text-primary font-medium"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              title={STATUT_BIEN_LABELS[s]}
            >
              {STATUT_BIEN_LABELS[s]}
            </button>
          );
        })}
      </div>
      {/* Date row */}
      <div className="flex items-center gap-0.5">
        {STATUT_BIEN_ORDER.map((s, i) => {
          const isActive = i <= currentIdx;
          const date = statusDates?.[s] ?? "";
          // Find the latest date among ALL earlier phases and earliest date among ALL later phases
          let prevDate: string | undefined;
          let prevLabel = "";
          for (let j = i - 1; j >= 0; j--) {
            const d = statusDates?.[STATUT_BIEN_ORDER[j]];
            if (d) { prevDate = d; prevLabel = STATUT_BIEN_LABELS[STATUT_BIEN_ORDER[j]]; break; }
          }
          let nextDate: string | undefined;
          let nextLabel = "";
          for (let j = i + 1; j < STATUT_BIEN_ORDER.length; j++) {
            const d = statusDates?.[STATUT_BIEN_ORDER[j]];
            if (d) { nextDate = d; nextLabel = STATUT_BIEN_LABELS[STATUT_BIEN_ORDER[j]]; break; }
          }

          const handleDateChange = (newDate: string) => {
            if (!newDate) { onDateChange?.(s, newDate); return; }
            if (prevDate && newDate < prevDate) {
              toast.error(`Date invalide`, { description: `${STATUT_BIEN_LABELS[s]} ne peut pas etre avant ${prevLabel} (${prevDate})` });
              return;
            }
            if (nextDate && newDate > nextDate) {
              toast.error(`Date invalide`, { description: `${STATUT_BIEN_LABELS[s]} ne peut pas etre apres ${nextLabel} (${nextDate})` });
              return;
            }
            onDateChange?.(s, newDate);
          };

          return (
            <div key={s} className="flex-1 text-center">
              {isActive ? (
                <input
                  type="date"
                  value={date}
                  min={prevDate || undefined}
                  max={nextDate || undefined}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full text-[9px] text-center bg-transparent border-b border-dotted border-muted-foreground/30 focus:border-primary outline-none py-0.5 tabular-nums text-muted-foreground"
                />
              ) : (
                <span className="text-[9px] text-muted-foreground/30 select-none">—</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Document row */}
      <div className="flex items-center gap-0.5">
        {STATUT_BIEN_ORDER.map((s, i) => {
          const isActive = i <= currentIdx;
          return (
            <div key={s} className="flex-1 text-center min-w-0">
              <DocCell
                status={s}
                doc={statusDocs?.[s]}
                isActive={isActive}
                onDocChange={onDocChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
