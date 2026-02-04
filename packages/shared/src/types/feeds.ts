import { z } from "zod";

// Source types (match Prisma SourceType enum)
export const SourceTypeSchema = z.enum([
  "HN",
  "GITHUB",
  "ARXIV",
  "NEWSAPI",
  "REDDIT",
  "LEADERBOARD",
  "HUGGINGFACE",
  "PRODUCTHUNT",
  "DEVTO",
  "YOUTUBE",
  "LOBSTERS",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

// Impact levels (match Prisma ImpactLevel enum)
export const ImpactLevelSchema = z.enum(["BREAKING", "HIGH", "MEDIUM", "LOW"]);
export type ImpactLevel = z.infer<typeof ImpactLevelSchema>;

// Event status (match Prisma EventStatus enum)
export const EventStatusSchema = z.enum([
  "RAW",
  "ENRICHED",
  "VERIFIED",
  "PUBLISHED",
  "QUARANTINED",
  "BLOCKED",
]);
export type EventStatus = z.infer<typeof EventStatusSchema>;

// Note: ArtifactType is exported from ./schemas/artifacts.ts
// Use that import for type safety with artifact payloads

// Raw feed item from external source
export const RawFeedItemSchema = z.object({
  sourceType: SourceTypeSchema,
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  author: z.string().optional(),
  publishedAt: z.date(),
  score: z.number().optional(),
  commentCount: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export type RawFeedItem = z.infer<typeof RawFeedItemSchema>;

// Normalized event for display
export const NormalizedEventSchema = z.object({
  id: z.string(),
  sourceType: SourceTypeSchema,
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  titleHr: z.string().optional(),
  occurredAt: z.date(),
  impactLevel: ImpactLevelSchema,
  sourceCount: z.number(),
  topics: z.array(z.string()),
  // Phase 3: Database fields
  status: EventStatusSchema.optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  gmTake: z.string().optional(),
});

export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

// Artifact payload for GM Transparency panel (uses string type for flexibility)
export const EventArtifactSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
  modelUsed: z.string(),
  version: z.number(),
});
export type EventArtifact = z.infer<typeof EventArtifactSchema>;

// LLM run data for observability
export const LLMRunSchema = z.object({
  id: z.string(),
  model: z.string(),
  costCents: z.number(),
  latencyMs: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  processorName: z.string(),
  createdAt: z.date(),
});
export type LLMRun = z.infer<typeof LLMRunSchema>;

// Event with full artifacts (for detail view)
export const EventWithArtifactsSchema = NormalizedEventSchema.extend({
  artifacts: z.array(EventArtifactSchema),
  llmRuns: z.array(LLMRunSchema).optional(),
});
export type EventWithArtifacts = z.infer<typeof EventWithArtifactsSchema>;

// Impact level heuristics
export function calculateImpactLevel(item: RawFeedItem): NormalizedEvent["impactLevel"] {
  const score = item.score ?? 0;
  if (score > 500) return "BREAKING";
  if (score > 200) return "HIGH";
  if (score > 50) return "MEDIUM";
  return "LOW";
}

// Topic extraction heuristics
export function extractTopics(item: RawFeedItem): string[] {
  const title = item.title.toLowerCase();
  const topics: string[] = [];

  const keywords: Record<string, string> = {
    openai: "OpenAI",
    gpt: "GPT",
    anthropic: "Anthropic",
    claude: "Claude",
    google: "Google",
    deepmind: "DeepMind",
    meta: "Meta",
    llama: "Llama",
    mistral: "Mistral",
    nvidia: "NVIDIA",
    transformer: "Transformers",
    "machine learning": "ML",
    "deep learning": "Deep Learning",
    benchmark: "Benchmark",
  };

  for (const [keyword, topic] of Object.entries(keywords)) {
    if (title.includes(keyword)) {
      topics.push(topic);
    }
  }

  return topics.slice(0, 5);
}
