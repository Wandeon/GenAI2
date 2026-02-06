// packages/trpc/src/routers/daily-briefings.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

/**
 * Daily Briefings Router
 *
 * Provides access to GM-generated daily briefings with top events.
 * Implements Architecture Constitution #4: Query-shaped APIs
 */
export const dailyBriefingsRouter = router({
  /**
   * Get today's briefing
   */
  today: publicProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const briefing = await ctx.db.dailyBriefing.findUnique({
      where: { date: today },
      include: {
        items: {
          orderBy: { rank: "asc" },
        },
      },
    });

    return briefing;
  }),

  /**
   * Get today's briefing, or fall back to the most recent available.
   * Returns { briefing, isLatest } so the UI can show a stale-data banner.
   */
  todayOrLatest: publicProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayBriefing = await ctx.db.dailyBriefing.findUnique({
      where: { date: today },
      include: { items: { orderBy: { rank: "asc" } } },
    });

    if (todayBriefing) {
      return { briefing: todayBriefing, isLatest: false };
    }

    const latest = await ctx.db.dailyBriefing.findFirst({
      orderBy: { date: "desc" },
      include: { items: { orderBy: { rank: "asc" } } },
    });

    return { briefing: latest, isLatest: true };
  }),

  /**
   * Get briefing by date
   */
  byDate: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const targetDate = new Date(input.date);
      targetDate.setHours(0, 0, 0, 0);

      const briefing = await ctx.db.dailyBriefing.findUnique({
        where: { date: targetDate },
        include: {
          items: {
            orderBy: { rank: "asc" },
          },
        },
      });

      return briefing;
    }),

  /**
   * List recent briefings
   */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(30).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const briefings = await ctx.db.dailyBriefing.findMany({
        orderBy: { date: "desc" },
        take: input.limit,
        include: {
          items: {
            orderBy: { rank: "asc" },
            take: 5,
          },
        },
      });

      return briefings;
    }),

  /**
   * Get briefing by ID with full event details
   */
  byIdWithEvents: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const briefing = await ctx.db.dailyBriefing.findUnique({
        where: { id: input },
        include: {
          items: {
            orderBy: { rank: "asc" },
          },
        },
      });

      if (!briefing) return null;

      // Get full event details for items
      const eventIds = briefing.items.map((i) => i.eventId);
      const events = await ctx.db.event.findMany({
        where: { id: { in: eventIds } },
        include: {
          artifacts: {
            where: {
              artifactType: { in: ["HEADLINE", "SUMMARY", "GM_TAKE", "WHY_MATTERS", "WHAT_HAPPENED"] },
            },
            orderBy: { version: "desc" },
          },
          evidence: {
            include: { snapshot: { include: { source: true } } },
          },
          mentions: { include: { entity: true } },
        },
      });

      const eventsMap = new Map(events.map((e) => [e.id, e]));

      return {
        ...briefing,
        events: briefing.items.map((item) => ({
          rank: item.rank,
          event: eventsMap.get(item.eventId) || null,
        })),
      };
    }),
});
