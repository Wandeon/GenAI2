// ============================================================================
// TOPIC ASSIGN UTILITIES
// ============================================================================
// Helper functions for topic assignment processor
// Split from topic-assign.ts per file size guidelines (max 200 lines utils)

import { calculateGeminiCost } from "@genai/llm";
import type { EventEvidence, TopicData } from "./topic-assign.types";

// ============================================================================
// CONSTANTS
// ============================================================================

export const PROCESSOR_NAME = "topic-assign";
export const PROMPT_VERSION = "1.0.0";

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for topic-assign processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 */
export function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[topic-assign] ${message}`);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build event text from title and evidence snapshots for LLM context.
 */
export function buildEventText(title: string, evidence: EventEvidence[]): string {
  const parts = [`Event title: ${title}`];

  for (const ev of evidence) {
    const snapshot = ev.snapshot;
    if (snapshot.title) parts.push(`Evidence title: ${snapshot.title}`);
    if (snapshot.fullText) parts.push(`Evidence content: ${snapshot.fullText}`);
  }

  return parts.join("\n\n");
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

export const TOPIC_ASSIGN_PROMPT = (
  eventText: string,
  availableTopics: TopicData[]
) => `
You are GM, an AI news curator. Assign 1-3 relevant topics to this news event.

${eventText}

Available topics (use ONLY these slugs):
${availableTopics.map((t) => `- ${t.slug}: ${t.name}`).join("\n")}

Guidelines:
- Assign 1-3 topics that best describe the event
- Use ONLY the exact slugs from the available topics list above
- Provide confidence scores (0.0 to 1.0) based on how relevant each topic is
- Higher confidence = more directly related to the core subject
- Do NOT make up new topics or use slugs not in the list

Respond with ONLY a JSON object in this exact format:
{
  "topics": [
    { "slug": "topic-slug-1", "confidence": 0.95 },
    { "slug": "topic-slug-2", "confidence": 0.8 }
  ]
}
`;
