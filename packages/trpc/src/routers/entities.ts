import { z } from "zod";
import { EntityType } from "@genai/db";
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

  // Fuzzy search entities by name, nameHr, or aliases
  fuzzySearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
        types: z.array(z.nativeEnum(EntityType)).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const entities = await ctx.db.entity.findMany({
        where: {
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { nameHr: { contains: input.query, mode: "insensitive" } },
            {
              aliases: {
                some: { alias: { contains: input.query, mode: "insensitive" } },
              },
            },
          ],
          ...(input.types && { type: { in: input.types } }),
        },
        include: {
          aliases: true,
          _count: { select: { mentions: true } },
        },
        orderBy: { importance: "desc" },
        take: input.limit,
      });

      return entities;
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

  // Get related entities through approved relationships
  related: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const relationships = await ctx.db.relationship.findMany({
        where: {
          OR: [{ sourceId: input.entityId }, { targetId: input.entityId }],
          status: "APPROVED",
        },
        include: {
          source: true,
          target: true,
        },
      });

      // Count connections per entity
      const connectionCounts = new Map<
        string,
        {
          entity: (typeof relationships)[0]["source"];
          count: number;
          types: Set<string>;
        }
      >();

      for (const rel of relationships) {
        const otherId =
          rel.sourceId === input.entityId ? rel.targetId : rel.sourceId;
        const other =
          rel.sourceId === input.entityId ? rel.target : rel.source;

        if (connectionCounts.has(otherId)) {
          const existing = connectionCounts.get(otherId)!;
          existing.count++;
          existing.types.add(rel.type);
        } else {
          connectionCounts.set(otherId, {
            entity: other,
            count: 1,
            types: new Set([rel.type]),
          });
        }
      }

      // Sort by count and limit
      const sorted = [...connectionCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, input.limit)
        .map(({ entity, count, types }) => ({
          entity,
          connectionCount: count,
          relationshipTypes: [...types],
        }));

      return sorted;
    }),

  // Get graph data for entity connections visualization
  graphData: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
        maxNodes: z.number().min(10).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const relationships = await ctx.db.relationship.findMany({
        where: {
          OR: [{ sourceId: input.entityId }, { targetId: input.entityId }],
          status: "APPROVED",
        },
        include: {
          source: true,
          target: true,
        },
        take: input.maxNodes,
      });

      const nodesMap = new Map<string, (typeof relationships)[0]["source"]>();
      const links: Array<{ source: string; target: string; type: string }> = [];

      for (const rel of relationships) {
        nodesMap.set(rel.sourceId, rel.source);
        nodesMap.set(rel.targetId, rel.target);
        links.push({
          source: rel.sourceId,
          target: rel.targetId,
          type: rel.type,
        });
      }

      const nodes = [...nodesMap.values()].map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        slug: e.slug,
      }));

      return { nodes, links };
    }),
});
