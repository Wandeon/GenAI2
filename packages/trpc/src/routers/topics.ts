import { z } from "zod";
import { router, publicProcedure } from "../trpc";

// Placeholder topics router
export const topicsRouter = router({
  // List all topics
  list: publicProcedure.query(async () => {
    // TODO: Implement with Prisma
    return [];
  }),

  // Get topic by slug
  bySlug: publicProcedure.input(z.string()).query(async ({ input: _input }) => {
    // TODO: Implement with Prisma
    return null;
  }),

  // Get events for a topic
  events: publicProcedure
    .input(
      z.object({
        topicSlug: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input: _input }) => {
      // TODO: Implement via EventTopic join
      return {
        items: [],
        nextCursor: null as string | null,
      };
    }),
});
