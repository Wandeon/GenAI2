import { z } from "zod";
import { router, publicProcedure } from "../trpc";

// Unified search result shape
const SearchResultSchema = z.object({
  id: z.string(),
  type: z.enum(["event", "entity", "topic"]),
  title: z.string(),
  titleHr: z.string().optional(),
  snippet: z.string().optional(),
  occurredAt: z.date().optional(),
  impactLevel: z.enum(["BREAKING", "HIGH", "MEDIUM", "LOW"]).optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const searchRouter = router({
  instant: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ input }) => {
      const q = input.query.toLowerCase();

      // Search mock events (will be replaced with FTS in Phase 1)
      const mockEvents = [
        {
          id: "1",
          title: "OpenAI announces GPT-5",
          titleHr: "OpenAI najavljuje GPT-5",
          occurredAt: new Date(),
          impactLevel: "BREAKING" as const,
        },
        {
          id: "2",
          title: "Anthropic raises $2B",
          titleHr: "Anthropic prikupio 2 milijarde",
          occurredAt: new Date(),
          impactLevel: "HIGH" as const,
        },
        {
          id: "3",
          title: "Google DeepMind releases Gemini 2",
          titleHr: "Google DeepMind objavljuje Gemini 2",
          occurredAt: new Date(),
          impactLevel: "HIGH" as const,
        },
      ];

      const results: SearchResult[] = mockEvents
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.titleHr?.toLowerCase().includes(q)
        )
        .slice(0, input.limit)
        .map((e) => ({
          id: e.id,
          type: "event" as const,
          title: e.title,
          titleHr: e.titleHr,
          occurredAt: e.occurredAt,
          impactLevel: e.impactLevel,
        }));

      return { results, total: results.length };
    }),
});
