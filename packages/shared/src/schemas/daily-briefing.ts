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
 * DailyBriefingPayload - GM-generated content for daily briefing
 *
 * Contains:
 * - changedSince: Summary of what changed since yesterday
 * - prediction: GM's prediction for the week (marked as speculation)
 * - action: Optional suggested action for readers
 * - gmNote: Optional personal note from GM
 * - Metadata: eventCount, sourceCount, topEntities
 */
export const DailyBriefingPayload = z.object({
  // What changed since yesterday
  changedSince: z.object({
    en: z.string(),
    hr: z.string(),
    highlights: z.array(z.string()).max(5),
  }),

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
});

export type DailyBriefingPayload = z.infer<typeof DailyBriefingPayload>;
