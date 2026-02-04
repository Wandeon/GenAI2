// ============================================================================
// DAILY BRIEFING UTILS
// ============================================================================
// Utility functions for daily-briefing processor
// Split from daily-briefing.ts per file size guidelines (max 200 lines utils)

import type { EventForBriefing } from "./daily-briefing.types";

export const PROCESSOR_NAME = "daily-briefing";
export const PROMPT_VERSION = "1.0.0";

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
 */
export function buildEventsText(events: EventForBriefing[]): string {
  return events
    .map((e, i) => {
      const headline = e.artifacts.find((a) => a.artifactType === "HEADLINE");
      const summary = e.artifacts.find((a) => a.artifactType === "SUMMARY");
      const headlineText =
        (headline?.payload as { en?: string })?.en || e.title;
      const summaryText =
        (summary?.payload as { en?: string })?.en || "No summary";
      const entities = e.mentions.map((m) => m.entity.name).join(", ");
      return `${i + 1}. ${headlineText}
   ${summaryText}
   Entities: ${entities || "None"}`;
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
 * Generate the briefing prompt for GM.
 */
export function generateBriefingPrompt(eventsText: string, date: string): string {
  return `You are GM, an AI news curator for Croatian audiences. Generate a daily briefing for ${date}.

Today's events (ranked by importance):
${eventsText}

Requirements:
1. Summarize what changed in AI world since yesterday
2. Provide a prediction for what to watch this week (mark speculation clearly)
3. Optionally suggest an action for readers
4. Add a personal GM note if appropriate
5. Never use corporate-speak (revolutionary, game-changing)
6. Croatian should use proper grammar (preposition "u", not "v")
7. Be honest about uncertainty

Respond with ONLY a JSON object in this exact format:
{
  "changedSince": {
    "en": "Brief summary of what changed",
    "hr": "Kratki pregled promjena",
    "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
  },
  "prediction": {
    "en": "What to watch this week",
    "hr": "Što pratiti ovaj tjedan",
    "confidence": "low" | "medium" | "high",
    "caveats": ["Caveat if any"]
  },
  "action": {
    "en": "Suggested reader action (optional)",
    "hr": "Preporučena radnja (opcionalno)"
  },
  "gmNote": {
    "en": "Personal note from GM (optional)",
    "hr": "Osobna poruka od GM-a (opcionalno)"
  },
  "eventCount": <number>,
  "sourceCount": <number>,
  "topEntities": ["Entity1", "Entity2"]
}`;
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
