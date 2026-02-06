"use client";

import { cn } from "@genai/ui";

// ============================================================================
// Types
// ============================================================================

export interface CompactEventRowProps {
  title: string;
  occurredAtLabel: string;
  impactLevel: "BREAKING" | "HIGH" | "MEDIUM" | "LOW";
  sourceCount: number;
  sourceLabel?: string;
  onOpen?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const IMPACT_DOT: Record<string, string> = {
  BREAKING: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-emerald-500",
  LOW: "bg-zinc-300",
};

function sourceCountLabel(n: number): string {
  return n === 1 ? "izvor" : "izvora";
}

// ============================================================================
// CompactEventRow
// ============================================================================

export function CompactEventRow({
  title,
  occurredAtLabel,
  impactLevel,
  sourceCount,
  sourceLabel,
  onOpen,
}: CompactEventRowProps) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left flex items-center gap-2 px-3 py-2",
        "active:bg-zinc-50 transition-colors",
        "border-b border-border last:border-b-0",
        "min-h-[44px]",
      )}
    >
      <span
        className={cn("w-2 h-2 rounded-full shrink-0", IMPACT_DOT[impactLevel])}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 text-sm leading-tight line-clamp-1">
        {title}
      </span>
      <span className="shrink-0 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
        {sourceLabel && <>{sourceLabel} · </>}
        {sourceCount} {sourceCountLabel(sourceCount)} · {occurredAtLabel}
      </span>
    </button>
  );
}
