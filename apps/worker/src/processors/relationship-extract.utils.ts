// ============================================================================
// RELATIONSHIP EXTRACT UTILITIES
// ============================================================================
// Helper functions for relationship extraction processor
// Split from relationship-extract.ts per file size guidelines (max 200 lines utils)

import { calculateGeminiCost } from "@genai/llm";
import type { RelationType } from "@genai/shared/graph-safety";
import type { EventEvidence, EntityMention } from "./relationship-extract.types";

// ============================================================================
// CONSTANTS
// ============================================================================

export const PROCESSOR_NAME = "relationship-extract";
export const PROMPT_VERSION = "1.0.0";

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for relationship-extract processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 */
export function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[relationship-extract] ${message}`);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build evidence text from snapshots for LLM context.
 */
export function buildEvidenceText(evidence: EventEvidence[]): string {
  return evidence
    .map((ev) => {
      const snapshot = ev.snapshot;
      const parts = [];
      if (snapshot.title) parts.push(`Title: ${snapshot.title}`);
      if (snapshot.fullText) parts.push(`Content: ${snapshot.fullText}`);
      if (snapshot.publishedAt)
        parts.push(`Published: ${snapshot.publishedAt.toISOString()}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * Build entity list for LLM context.
 */
export function buildEntityList(mentions: EntityMention[]): string {
  return mentions
    .map((m) => `- ${m.entity.name} (${m.entity.type}, role: ${m.role})`)
    .join("\n");
}

/**
 * Calculate cost in cents based on provider.
 */
export function calculateCost(
  provider: string,
  inputTokens: number,
  outputTokens: number
): number {
  if (provider === "google") {
    return calculateGeminiCost(inputTokens, outputTokens);
  }
  // Default to Gemini pricing for mock/unknown providers
  return calculateGeminiCost(inputTokens, outputTokens);
}

// ============================================================================
// RELATIONSHIP TYPES
// ============================================================================

export const RELATIONSHIP_TYPES: RelationType[] = [
  "RELEASED",
  "ANNOUNCED",
  "PUBLISHED",
  "PARTNERED",
  "INTEGRATED",
  "FUNDED",
  "ACQUIRED",
  "BANNED",
  "BEATS",
  "CRITICIZED",
];

// ============================================================================
// PROMPT TEMPLATE
// ============================================================================

export const RELATIONSHIP_EXTRACT_PROMPT = (
  title: string,
  evidenceText: string,
  entityList: string
) => `
You are GM, an AI news curator. Extract relationships between entities mentioned in this news event.

Event title: ${title}

Evidence:
${evidenceText}

Entities mentioned:
${entityList}

Extract relationships of these types:
- RELEASED: Entity released a product/model (e.g., "OpenAI released GPT-5")
- ANNOUNCED: Entity announced news (e.g., "Google announced partnership")
- PUBLISHED: Entity published research (e.g., "Lab published paper")
- PARTNERED: Two entities formed partnership
- INTEGRATED: Entity integrated with another product/service
- FUNDED: Entity funded another entity (investor -> company)
- ACQUIRED: Entity acquired another entity
- BANNED: Regulator banned entity/product
- BEATS: Model/product beats another on benchmark
- CRITICIZED: Entity criticized another entity

Rules:
1. Only extract relationships between entities in the list above
2. Use exact entity names from the list
3. Source is the entity performing the action
4. Target is the entity receiving the action
5. Provide confidence scores (0.0 to 1.0)

Respond with ONLY a JSON object in this exact format:
{
  "relationships": [
    { "sourceEntity": "OpenAI", "targetEntity": "GPT-5", "type": "RELEASED", "confidence": 0.95 }
  ]
}

If no relationships can be extracted, respond with: { "relationships": [] }
`;
