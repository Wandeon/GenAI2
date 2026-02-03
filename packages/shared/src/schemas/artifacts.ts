import { z } from "zod";

// ============================================================================
// ARTIFACT PAYLOAD SCHEMAS - Typed JSON payloads for GM outputs
// ============================================================================

export const HeadlinePayload = z.object({
  en: z.string(),
  hr: z.string(),
});

export const SummaryPayload = z.object({
  en: z.string(),
  hr: z.string(),
  bulletPoints: z.array(z.string()).max(5),
});

export const GMTakePayload = z.object({
  take: z.string(),
  takeHr: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  caveats: z.array(z.string()).optional(),
});

export const WhyMattersPayload = z.object({
  text: z.string(),
  textHr: z.string(),
  audience: z.array(
    z.enum(["developers", "executives", "researchers", "investors", "general"])
  ),
});

export const EntityExtractPayload = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.enum([
        "COMPANY",
        "LAB",
        "MODEL",
        "PRODUCT",
        "PERSON",
        "REGULATION",
        "DATASET",
        "BENCHMARK",
      ]),
      role: z.enum(["SUBJECT", "OBJECT", "MENTIONED"]),
      confidence: z.number().min(0).max(1),
    })
  ),
});

export const TopicAssignPayload = z.object({
  topics: z.array(
    z.object({
      slug: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type HeadlinePayload = z.infer<typeof HeadlinePayload>;
export type SummaryPayload = z.infer<typeof SummaryPayload>;
export type GMTakePayload = z.infer<typeof GMTakePayload>;
export type WhyMattersPayload = z.infer<typeof WhyMattersPayload>;
export type EntityExtractPayload = z.infer<typeof EntityExtractPayload>;
export type TopicAssignPayload = z.infer<typeof TopicAssignPayload>;

// ============================================================================
// ARTIFACT TYPE MAP - Maps ArtifactType enum to payload schema
// ============================================================================

export const ArtifactSchemas = {
  HEADLINE: HeadlinePayload,
  SUMMARY: SummaryPayload,
  GM_TAKE: GMTakePayload,
  WHY_MATTERS: WhyMattersPayload,
  ENTITY_EXTRACT: EntityExtractPayload,
  TOPIC_ASSIGN: TopicAssignPayload,
} as const;

export type ArtifactType = keyof typeof ArtifactSchemas;

export type ArtifactPayloadMap = {
  HEADLINE: HeadlinePayload;
  SUMMARY: SummaryPayload;
  GM_TAKE: GMTakePayload;
  WHY_MATTERS: WhyMattersPayload;
  ENTITY_EXTRACT: EntityExtractPayload;
  TOPIC_ASSIGN: TopicAssignPayload;
};

// Validate payload against artifact type
export function validateArtifactPayload<T extends ArtifactType>(
  type: T,
  payload: unknown
): ArtifactPayloadMap[T] {
  const schema = ArtifactSchemas[type];
  return schema.parse(payload) as ArtifactPayloadMap[T];
}
