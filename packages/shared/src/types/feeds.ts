import { z } from "zod";

// Raw feed item from external source
export const RawFeedItemSchema = z.object({
  sourceType: z.enum(["HN", "GITHUB", "ARXIV"]),
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
  sourceType: z.enum(["HN", "GITHUB", "ARXIV"]),
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  titleHr: z.string().optional(),
  occurredAt: z.date(),
  impactLevel: z.enum(["BREAKING", "HIGH", "MEDIUM", "LOW"]),
  sourceCount: z.number(),
  topics: z.array(z.string()),
});

export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

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
