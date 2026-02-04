import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const entitiesRouter = router({
  // Get entity by slug with aliases and mention counts
  bySlug: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const entity = await ctx.db.entity.findUnique({
      where: { slug: input },
      include: {
        aliases: true,
        _count: {
          select: {
            mentions: true,
            sourceRels: true,
            targetRels: true,
          },
        },
      },
    });

    return entity;
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
