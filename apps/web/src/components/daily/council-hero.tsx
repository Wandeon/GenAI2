"use client";

import { useState } from "react";
import { cn } from "@genai/ui";
import { RoundtableSection } from "./roundtable-section";

// ============================================================================
// Types
// ============================================================================

interface RoundtableTurn {
  persona: "GM" | "Engineer" | "Skeptic";
  moveType:
    | "SETUP"
    | "TECH_READ"
    | "RISK_CHECK"
    | "CROSS_EXAM"
    | "EVIDENCE_CALL"
    | "TAKEAWAY"
    | "CUT";
  text: string;
  textHr: string;
  eventRef?: number;
}

interface CouncilHeroProps {
  turns: RoundtableTurn[];
  previewCount?: number;
}

// ============================================================================
// Constants
// ============================================================================

const PERSONA_CONFIG: Record<
  string,
  { initial: string; bgColor: string; borderColor: string }
> = {
  GM: {
    initial: "GM",
    bgColor: "bg-amber-100 text-amber-800",
    borderColor: "border-l-amber-500",
  },
  Engineer: {
    initial: "E",
    bgColor: "bg-stone-100 text-stone-700",
    borderColor: "border-l-stone-300",
  },
  Skeptic: {
    initial: "S",
    bgColor: "bg-stone-100 text-stone-700",
    borderColor: "border-l-stone-300",
  },
};

// ============================================================================
// CouncilHero
// ============================================================================

export function CouncilHero({ turns, previewCount = 3 }: CouncilHeroProps) {
  const [expanded, setExpanded] = useState(false);

  if (turns.length === 0) return null;

  const previewTurns = turns
    .filter((t) => t.moveType !== "CUT")
    .slice(0, previewCount);

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Vijece
      </h2>

      {expanded ? (
        <div className="space-y-3">
          <RoundtableSection turns={turns} />
          <button
            onClick={() => setExpanded(false)}
            className="text-sm text-primary font-medium hover:underline min-h-[44px] flex items-center"
          >
            Sakrij raspravu
          </button>
        </div>
      ) : (
        <div className="space-y-0">
          {previewTurns.map((turn, i) => (
            <TurnPreview key={i} turn={turn} />
          ))}
          <button
            onClick={() => setExpanded(true)}
            className="mt-3 text-sm text-primary font-medium hover:underline min-h-[44px] flex items-center"
          >
            Prikazi cijelu raspravu ({turns.length})
          </button>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// TurnPreview
// ============================================================================

function TurnPreview({ turn }: { turn: RoundtableTurn }) {
  const config = PERSONA_CONFIG[turn.persona] ?? PERSONA_CONFIG.GM;

  return (
    <div
      className={cn(
        "border-l-4 pl-3 py-3 flex items-start gap-3",
        config.borderColor,
      )}
    >
      <span
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          "text-xs font-bold shrink-0",
          config.bgColor,
        )}
        aria-hidden="true"
      >
        {config.initial}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-bold">{turn.persona}</span>
        <p className="text-sm leading-relaxed text-muted-foreground mt-0.5">
          {turn.textHr}
        </p>
      </div>
    </div>
  );
}
