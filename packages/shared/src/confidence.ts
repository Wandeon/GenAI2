/**
 * Confidence scoring rubric - trust-tier-aware.
 *
 * Rules:
 * - 1 AUTHORITATIVE source → HIGH
 * - 3+ sources with at least 1 STANDARD or above → HIGH
 * - 2 sources with at least 1 STANDARD or above → MEDIUM
 * - 2+ LOW-only sources → MEDIUM
 * - 1 STANDARD source → MEDIUM
 * - 1 LOW source → LOW
 *
 * Publish gate:
 * - HIGH/MEDIUM → PUBLISHED
 * - LOW → QUARANTINED
 */

export type TrustTier = "AUTHORITATIVE" | "STANDARD" | "LOW";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface EvidenceTrustProfile {
  sourceCount: number;
  tiers: TrustTier[];
}

export function computeConfidence(profile: EvidenceTrustProfile): ConfidenceLevel {
  const { sourceCount, tiers } = profile;

  if (sourceCount === 0) return "LOW";

  const hasAuthoritative = tiers.includes("AUTHORITATIVE");
  const hasStandard = tiers.includes("STANDARD");

  // 1 AUTHORITATIVE → HIGH
  if (hasAuthoritative) return "HIGH";

  // 3+ sources with at least 1 STANDARD → HIGH
  if (sourceCount >= 3 && hasStandard) return "HIGH";

  // 2+ sources with at least 1 STANDARD → MEDIUM
  if (sourceCount >= 2 && hasStandard) return "MEDIUM";

  // 2+ LOW-only sources → MEDIUM
  if (sourceCount >= 2) return "MEDIUM";

  // 1 STANDARD → MEDIUM
  if (hasStandard) return "MEDIUM";

  // 1 LOW → LOW
  return "LOW";
}

export function confidenceToStatus(
  confidence: ConfidenceLevel
): "PUBLISHED" | "QUARANTINED" {
  return confidence === "LOW" ? "QUARANTINED" : "PUBLISHED";
}
