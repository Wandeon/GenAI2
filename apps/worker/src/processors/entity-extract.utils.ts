// ============================================================================
// ENTITY EXTRACT UTILITIES
// ============================================================================
// Helper functions for entity extraction processor
// Split from entity-extract.ts per file size guidelines (max 200 lines utils)

import { calculateGeminiCost } from "@genai/llm";
import type { EventEvidence } from "./entity-extract.types";

// ============================================================================
// CONSTANTS
// ============================================================================

export const PROCESSOR_NAME = "entity-extract";
export const PROMPT_VERSION = "1.0.0";

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for entity-extract processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 */
export function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[entity-extract] ${message}`);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a URL-safe slug from an entity name.
 *
 * @param name - The entity name to slugify
 * @returns A URL-safe slug
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    // Normalize unicode characters (e -> e, u -> u, etc.)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Replace special characters with hyphens
    .replace(/[^a-z0-9]+/g, "-")
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, "")
    // Collapse multiple hyphens
    .replace(/-+/g, "-");
}

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
// PROMPT TEMPLATE
// ============================================================================

export const ENTITY_EXTRACT_PROMPT = (title: string, evidenceText: string) => `
You are GM, an AI news curator. Extract all named entities from this news event.

Event title: ${title}

Evidence:
${evidenceText}

Extract entities of these types:
- COMPANY: Companies (OpenAI, Google, Microsoft, etc.)
- LAB: Research labs (DeepMind, FAIR, etc.)
- MODEL: AI models (GPT-5, Claude, Llama, etc.)
- PRODUCT: Products and services (ChatGPT, Copilot, etc.)
- PERSON: People (Sam Altman, Demis Hassabis, etc.)
- REGULATION: Laws and regulations (EU AI Act, etc.)
- DATASET: Datasets (ImageNet, Common Crawl, etc.)
- BENCHMARK: Benchmarks (MMLU, HumanEval, etc.)

Assign roles:
- SUBJECT: Primary actor in the event
- OBJECT: Thing being acted upon
- MENTIONED: Referenced but not central

Provide confidence scores (0.0 to 1.0) based on:
- How clearly the entity is identified
- How central it is to the event

Respond with ONLY a JSON object in this exact format:
{
  "entities": [
    { "name": "OpenAI", "type": "COMPANY", "role": "SUBJECT", "confidence": 0.95 },
    { "name": "GPT-5", "type": "MODEL", "role": "OBJECT", "confidence": 0.9 }
  ]
}
`;
