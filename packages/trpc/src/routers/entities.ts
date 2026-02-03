import { z } from "zod";
import { router, publicProcedure } from "../trpc";

// Placeholder entities router - will query Entity model
export const entitiesRouter = router({
  // Get entity by slug
  bySlug: publicProcedure.input(z.string()).query(async ({ input: _input }) => {
    // TODO: Implement with Prisma
    return null;
  }),

  // Search entities with fuzzy matching
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        type: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input: _input }) => {
      // TODO: Implement with aliases and fuzzy matching
      return [];
    }),

  // Get entity timeline (events mentioning this entity)
  timeline: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input: _input }) => {
      // TODO: Implement via EntityMention join
      return {
        items: [],
        nextCursor: null as string | null,
      };
    }),
});
