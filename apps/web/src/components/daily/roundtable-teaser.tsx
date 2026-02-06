"use client";

import { useState } from "react";
import { RoundtableSection } from "./roundtable-section";

interface RoundtableTurn {
  persona: "GM" | "Engineer" | "Skeptic";
  moveType: "SETUP" | "TECH_READ" | "RISK_CHECK" | "CROSS_EXAM" | "EVIDENCE_CALL" | "TAKEAWAY" | "CUT";
  text: string;
  textHr: string;
  eventRef?: number;
}

interface RoundtableTeaserProps {
  turns: RoundtableTurn[];
  previewCount?: number;
}

export function RoundtableTeaser({ turns, previewCount = 2 }: RoundtableTeaserProps) {
  const [expanded, setExpanded] = useState(false);

  if (turns.length === 0) return null;

  const previewTurns = turns.slice(0, previewCount);

  return (
    <div className="border-l-2 border-primary pl-4 py-3">
      {expanded ? (
        <>
          <RoundtableSection turns={turns} />
          <button
            onClick={() => setExpanded(false)}
            className="mt-3 text-sm text-primary font-medium hover:underline"
          >
            Sakrij raspravu
          </button>
        </>
      ) : (
        <>
          {previewTurns.map((turn, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{turn.persona}:</span>{" "}
              {turn.textHr.length > 120
                ? turn.textHr.slice(0, 120) + "..."
                : turn.textHr}
            </p>
          ))}
          <button
            onClick={() => setExpanded(true)}
            className="mt-2 text-sm text-primary font-medium hover:underline"
          >
            Prikazi raspravu ({turns.length})
          </button>
        </>
      )}
    </div>
  );
}
