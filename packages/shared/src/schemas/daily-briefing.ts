import { z } from "zod";

// ============================================================================
// DAILY BRIEFING PAYLOAD SCHEMA - GM-generated content for daily briefing
// ============================================================================
// Implements Architecture Constitution #3: STRUCTURED OVER TEXT
// Payload stored in DailyBriefing.payload field, validated at creation

/**
 * Bilingual text with English and Croatian versions.
 */
const BilingualText = z.object({
  en: z.string(),
  hr: z.string(),
});

/**
 * A single turn in the Council Roundtable discussion.
 * Three personas (GM, Engineer, Skeptic) debate the day's events.
 */
export const RoundtableTurn = z.object({
  persona: z.enum(["GM", "Engineer", "Skeptic"]),
  moveType: z.enum([
    "SETUP",
    "TECH_READ",
    "RISK_CHECK",
    "CROSS_EXAM",
    "EVIDENCE_CALL",
    "TAKEAWAY",
    "CUT",
  ]),
  text: z.string(),
  textHr: z.string(),
  eventRef: z.number().int().min(1).max(10).optional(),
});

export type RoundtableTurn = z.infer<typeof RoundtableTurn>;

/**
 * DailyBriefingPayload - GM-generated content for daily briefing
 *
 * Contains:
 * - roundtable: Council Roundtable discussion (new format, v2.0.0+)
 * - changedSince: Summary of what changed since yesterday (legacy, v1.x)
 * - prediction: GM's prediction for the week (marked as speculation)
 * - action: Optional suggested action for readers
 * - gmNote: Optional personal note from GM
 * - Metadata: eventCount, sourceCount, topEntities
 */
export const DailyBriefingPayload = z.object({
  // New: Council Roundtable discussion (v2.0.0+)
  roundtable: z.array(RoundtableTurn).min(4).max(20).optional(),

  // Legacy: what changed since yesterday (deprecated, kept for old briefings)
  changedSince: z
    .object({
      en: z.string(),
      hr: z.string(),
      highlights: z.array(z.string()).max(5),
    })
    .optional(),

  // GM's prediction for the week
  prediction: z.object({
    en: z.string(),
    hr: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
    caveats: z.array(z.string()).optional(),
  }),

  // Suggested action for readers (optional)
  action: BilingualText.optional(),

  // GM's personal note (optional)
  gmNote: BilingualText.optional(),

  // Metadata
  eventCount: z.number().int().nonnegative(),
  sourceCount: z.number().int().nonnegative(),
  topEntities: z.array(z.string()).max(5),

  // Multi-turn generation metadata (v3.0.0+)
  generationMeta: z
    .object({
      totalTurns: z.number().int(),
      totalInputTokens: z.number().int(),
      totalOutputTokens: z.number().int(),
      turnCount: z.number().int(),
      fallbackUsed: z.boolean(),
    })
    .optional(),
});

export type DailyBriefingPayload = z.infer<typeof DailyBriefingPayload>;
