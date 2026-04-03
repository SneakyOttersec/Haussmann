"use client";

import type { PropertyStatus } from "@/types";
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUS_ORDER } from "@/types";

interface PropertyStatusBarProps {
  statut: PropertyStatus;
  onChange: (s: PropertyStatus) => void;
}

export function PropertyStatusBar({ statut, onChange }: PropertyStatusBarProps) {
  const currentIdx = PROPERTY_STATUS_ORDER.indexOf(statut);

  return (
    <div className="flex items-center gap-0.5">
      {PROPERTY_STATUS_ORDER.map((s, i) => {
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
            title={PROPERTY_STATUS_LABELS[s]}
          >
            {PROPERTY_STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
