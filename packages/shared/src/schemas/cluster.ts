import { z } from "zod";

/**
 * ClusterDecision - LLM judge output for event clustering.
 *
 * The judge receives ONE incoming snapshot and N candidate events.
 * It returns either the ID of the best-matching event or null for "new event".
 */
export const ClusterDecisionSchema = z.object({
  matchedEventId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
});

export type ClusterDecision = z.infer<typeof ClusterDecisionSchema>;
