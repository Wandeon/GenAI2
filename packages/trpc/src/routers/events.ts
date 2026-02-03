// packages/trpc/src/routers/events.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { fetchHNTopStories } from "../services/hn-feed";
import { fetchGitHubTrending } from "../services/github-feed";
import { fetchArxivPapers } from "../services/arxiv-feed";
import type { NormalizedEvent } from "@genai/shared";

const ImpactLevel = z.enum(["BREAKING", "HIGH", "MEDIUM", "LOW"]);

// Cache for feed results (simple in-memory, 5 min TTL)
let feedCache: { events: NormalizedEvent[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAggregatedEvents(): Promise<NormalizedEvent[]> {
  const now = Date.now();

  if (feedCache && now - feedCache.timestamp < CACHE_TTL) {
    return feedCache.events;
  }

  // Fetch all feeds in parallel
  const [hnEvents, ghEvents, arxivEvents] = await Promise.all([
    fetchHNTopStories(30),
    fetchGitHubTrending(),
    fetchArxivPapers(),
  ]);

  // Combine and sort by date
  const allEvents = [...hnEvents, ...ghEvents, ...arxivEvents];
  allEvents.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  feedCache = { events: allEvents, timestamp: now };
  return allEvents;
}

export const eventsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        sourceType: z.enum(["HN", "GITHUB", "ARXIV"]).optional(),
        impactLevel: ImpactLevel.optional(),
        beforeTime: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      let items = await getAggregatedEvents();

      // Filter by source type
      if (input.sourceType) {
        items = items.filter((e) => e.sourceType === input.sourceType);
      }

      // Filter by time
      if (input.beforeTime) {
        items = items.filter(
          (e) => e.occurredAt.getTime() <= input.beforeTime!.getTime()
        );
      }

      // Filter by impact
      if (input.impactLevel) {
        items = items.filter((e) => e.impactLevel === input.impactLevel);
      }

      // Apply limit
      items = items.slice(0, input.limit);

      return {
        items,
        nextCursor: null as string | null,
      };
    }),

  byId: publicProcedure.input(z.string()).query(async ({ input }) => {
    const events = await getAggregatedEvents();
    return events.find((e) => e.id === input) ?? null;
  }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const events = await getAggregatedEvents();
      const q = input.query.toLowerCase();

      return events
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.topics.some((t) => t.toLowerCase().includes(q))
        )
        .slice(0, input.limit);
    }),
});
