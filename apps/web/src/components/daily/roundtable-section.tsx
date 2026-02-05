"use client";

// Types
interface RoundtableTurn {
  persona: "GM" | "Engineer" | "Skeptic";
  moveType: "SETUP" | "TECH_READ" | "RISK_CHECK" | "CROSS_EXAM" | "EVIDENCE_CALL" | "TAKEAWAY";
  text: string;
  textHr: string;
  eventRef?: number;
}

interface RoundtableSectionProps {
  turns: RoundtableTurn[];
}

// Persona styling
const personaStyle: Record<string, { name: string; text: string; border: string }> = {
  GM: { name: "GM", text: "text-cyan-400", border: "border-l-cyan-500/50" },
  Engineer: { name: "Engineer", text: "text-green-400", border: "border-l-green-500/50" },
  Skeptic: { name: "Skeptic", text: "text-amber-400", border: "border-l-amber-500/50" },
};

// Move type labels in Croatian
const moveLabels: Record<string, string> = {
  SETUP: "Uvod",
  TECH_READ: "Tehnički uvid",
  RISK_CHECK: "Provjera",
  CROSS_EXAM: "Ispitivanje",
  EVIDENCE_CALL: "Dokazi?",
  TAKEAWAY: "Zaključak",
};

export function RoundtableSection({ turns }: RoundtableSectionProps) {
  return (
    <div className="space-y-3">
      {turns.map((turn, i) => {
        const style = personaStyle[turn.persona] ?? personaStyle.GM;
        return (
          <div
            key={i}
            className={`pl-4 border-l-2 ${style.border} py-2`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-semibold ${style.text}`}>
                {style.name}
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {moveLabels[turn.moveType] ?? turn.moveType}
              </span>
              {turn.eventRef && (
                <span className="text-xs text-primary/70 font-mono">
                  #{turn.eventRef}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground">{turn.textHr}</p>
          </div>
        );
      })}
    </div>
  );
}
