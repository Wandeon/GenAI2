// ============================================================================
// DAILY BRIEFING UTILS
// ============================================================================
// Utility functions for daily-briefing processor
// Split from daily-briefing.ts per file size guidelines (max 200 lines utils)

import type { EventForBriefing } from "./daily-briefing.types";

export const PROCESSOR_NAME = "daily-briefing";
export const PROMPT_VERSION = "2.0.0";

/**
 * Tagged logger for daily-briefing processor.
 * Suppressed during tests via NODE_ENV check.
 */
export function log(message: string): void {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[daily-briefing] ${message}`);
  }
}

/**
 * Build events text for LLM prompt from loaded events.
 * Gracefully includes WHAT_HAPPENED and WHY_MATTERS when present.
 */
export function buildEventsText(events: EventForBriefing[]): string {
  return events
    .map((e, i) => {
      const headline = e.artifacts.find((a) => a.artifactType === "HEADLINE");
      const summary = e.artifacts.find((a) => a.artifactType === "SUMMARY");
      const whatHappened = e.artifacts.find((a) => a.artifactType === "WHAT_HAPPENED");
      const whyMatters = e.artifacts.find((a) => a.artifactType === "WHY_MATTERS");

      const headlineText =
        (headline?.payload as { en?: string })?.en || e.title;
      const summaryText =
        (summary?.payload as { en?: string })?.en || "No summary";
      const whatText = (whatHappened?.payload as { en?: string })?.en;
      const whyText = (whyMatters?.payload as { text?: string })?.text;
      const entities = e.mentions.map((m) => m.entity.name).join(", ");

      let block = `${i + 1}. ${headlineText}\n   ${summaryText}`;
      if (whatText) block += `\n   What happened: ${whatText}`;
      if (whyText) block += `\n   Why it matters: ${whyText}`;
      block += `\n   Entities: ${entities || "None"}`;
      return block;
    })
    .join("\n\n");
}

/**
 * Count unique sources from events.
 */
export function countUniqueSources(events: EventForBriefing[]): number {
  const sourceIds = new Set(
    events.flatMap((e) => e.evidence.map((ev) => ev.snapshot.source.id))
  );
  return sourceIds.size;
}

/**
 * Extract top entities by frequency from events.
 */
export function extractTopEntities(
  events: EventForBriefing[],
  limit: number = 5
): string[] {
  const entityCounts = new Map<string, number>();
  for (const event of events) {
    for (const mention of event.mentions) {
      const name = mention.entity.name;
      entityCounts.set(name, (entityCounts.get(name) || 0) + 1);
    }
  }
  return Array.from(entityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * Parse JSON from LLM response, handling markdown code blocks.
 */
export function parseJsonResponse(content: string): unknown {
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  }
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  return JSON.parse(jsonStr.trim());
}
