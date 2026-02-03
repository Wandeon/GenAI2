// ============================================================================
// GRAPH SAFETY GATE - Validates relationships before adding to graph
// ============================================================================
// Key principle: Model confidence is LOGGED, not used for approval.
// Approval depends on source quality and count, not LLM confidence.

export type TrustTier = "AUTHORITATIVE" | "STANDARD" | "LOW";

export type RelationType =
  // Low risk - single source OK
  | "RELEASED"
  | "ANNOUNCED"
  | "PUBLISHED"
  // Medium risk - prefer 2+ sources
  | "PARTNERED"
  | "INTEGRATED"
  | "FUNDED"
  // High risk - require authoritative source OR 2+ sources
  | "ACQUIRED"
  | "BANNED"
  | "BEATS"
  | "CRITICIZED";

export type RelationshipStatus =
  | "PENDING"
  | "APPROVED"
  | "QUARANTINED"
  | "REJECTED";

export interface RelationshipProposal {
  sourceEntity: string;
  targetEntity: string;
  type: RelationType;
  eventId: string;
  modelConfidence: number; // LOGGED ONLY, not used for approval
}

export interface SafetyResult {
  status: RelationshipStatus;
  reason: string;
}

const RISK_LEVELS: Record<RelationType, "LOW" | "MEDIUM" | "HIGH"> = {
  // Low risk - single source OK
  RELEASED: "LOW",
  ANNOUNCED: "LOW",
  PUBLISHED: "LOW",
  // Medium risk - prefer 2+ sources
  PARTNERED: "MEDIUM",
  INTEGRATED: "MEDIUM",
  FUNDED: "MEDIUM",
  // High risk - require authoritative source OR 2+ sources
  ACQUIRED: "HIGH",
  BANNED: "HIGH",
  BEATS: "HIGH",
  CRITICIZED: "HIGH",
};

/**
 * Validates a relationship proposal against safety rules.
 *
 * Rules:
 * - Low risk: Single source OK
 * - Medium risk: Require 2+ sources OR authoritative source
 * - High risk: MUST have authoritative source OR 2+ sources
 *
 * Model confidence is intentionally ignored for approval decisions.
 * It is logged for analysis but does not influence the safety gate.
 */
export function validateRelationship(
  proposal: RelationshipProposal,
  evidenceTrustTier: TrustTier,
  sourceCount: number
): SafetyResult {
  const risk = RISK_LEVELS[proposal.type];

  // Low risk: single source OK
  if (risk === "LOW") {
    return { status: "APPROVED", reason: "Low-risk relationship with evidence" };
  }

  // Medium risk: require 2+ sources OR authoritative
  if (risk === "MEDIUM") {
    if (evidenceTrustTier === "AUTHORITATIVE") {
      return { status: "APPROVED", reason: "Authoritative source" };
    }
    if (sourceCount >= 2) {
      return { status: "APPROVED", reason: "Multiple sources confirm" };
    }
    // Single non-authoritative source → quarantine for review
    return {
      status: "QUARANTINED",
      reason: "Medium-risk needs 2+ sources or authoritative",
    };
  }

  // High risk: MUST have authoritative OR 2+ sources
  if (risk === "HIGH") {
    if (evidenceTrustTier === "AUTHORITATIVE") {
      return {
        status: "APPROVED",
        reason: "Authoritative source for high-risk",
      };
    }
    if (sourceCount >= 2) {
      return {
        status: "APPROVED",
        reason: "Multiple sources confirm high-risk",
      };
    }
    // High risk without strong evidence → quarantine
    return {
      status: "QUARANTINED",
      reason: "High-risk requires authoritative source or 2+ sources",
    };
  }

  return { status: "REJECTED", reason: "Unknown risk level" };
}

/**
 * Get risk level for a relationship type
 */
export function getRiskLevel(type: RelationType): "LOW" | "MEDIUM" | "HIGH" {
  return RISK_LEVELS[type];
}

/**
 * Check if a relationship type is high risk
 */
export function isHighRisk(type: RelationType): boolean {
  return RISK_LEVELS[type] === "HIGH";
}
