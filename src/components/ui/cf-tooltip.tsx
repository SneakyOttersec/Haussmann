"use client";

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface BreakdownRow {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
  separator?: boolean;
}

interface CfTooltipProps {
  rows: BreakdownRow[];
  children: React.ReactNode;
}

/**
 * Styled cash-flow breakdown tooltip — matches the app's monospace / dotted-border
 * design language. Wraps any trigger element.
 */
export function CfTooltip({ rows, children }: CfTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="cursor-default h-full" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="bg-background text-foreground border border-dotted border-muted-foreground/30 shadow-lg px-3 py-2 max-w-xs"
      >
        <div className="space-y-0.5 font-mono text-[11px]">
          {rows.map((r, i) =>
            r.separator ? (
              <div key={i} className="border-t border-dashed border-muted-foreground/20 my-1" />
            ) : (
              <div key={i} className={`flex justify-between gap-4 ${r.bold ? "font-bold" : ""}`}>
                <span className={r.color ?? "text-muted-foreground"}>{r.label}</span>
                <span className={`tabular-nums ${r.color ?? (r.bold ? "text-foreground" : "text-muted-foreground")}`}>{r.value}</span>
              </div>
            )
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
