export interface RoundtableTurn {
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

export interface BriefingPayload {
  roundtable?: RoundtableTurn[];
  changedSince?: { en: string; hr: string; highlights: string[] };
  prediction?: {
    en: string;
    hr: string;
    confidence: string;
    caveats?: string[];
  };
  eventCount: number;
  sourceCount: number;
  topEntities: string[];
}
