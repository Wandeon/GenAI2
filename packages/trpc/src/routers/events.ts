import { z } from "zod";
import { router, publicProcedure } from "../trpc";

// Placeholder events router - will query Event model
export const eventsRouter = router({
  // List events with pagination
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        status: z.string().optional(),
      })
    )
    .query(async ({ input: _input }) => {
      // TODO: Implement with Prisma
      return {
        items: [],
        nextCursor: null as string | null,
      };
    }),

  // Get single event by ID
  byId: publicProcedure.input(z.string()).query(async ({ input: _input }) => {
    // TODO: Implement with Prisma
    return null;
  }),

  // Search events
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input: _input }) => {
      // TODO: Implement with PostgreSQL FTS
      return [];
    }),
});
