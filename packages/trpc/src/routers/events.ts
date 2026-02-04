// packages/trpc/src/routers/events.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import type { NormalizedEvent } from "@genai/shared";

// Zod schemas for Prisma enums
const SourceType = z.enum([
  "HN",
  "GITHUB",
  "ARXIV",
  "NEWSAPI",
  "REDDIT",
  "LOBSTERS",
  "PRODUCTHUNT",
  "DEVTO",
  "YOUTUBE",
  "LEADERBOARD",
  "HUGGINGFACE",
]);
const ImpactLevel = z.enum(["BREAKING", "HIGH", "MEDIUM", "LOW"]);
const EventStatus = z.enum([
  "RAW",
  "ENRICHED",
  "VERIFIED",
  "PUBLISHED",
  "QUARANTINED",
  "BLOCKED",
]);

// Transform database event to NormalizedEvent
function toNormalizedEvent(event: any): NormalizedEvent {
  // Extract artifacts for quick access
  const headlineArtifact = event.artifacts?.find(
    (a: any) => a.artifactType === "HEADLINE"
  );
  const summaryArtifact = event.artifacts?.find(
    (a: any) => a.artifactType === "SUMMARY"
  );
  const gmTakeArtifact = event.artifacts?.find(
    (a: any) => a.artifactType === "GM_TAKE"
  );

  return {
    id: event.id,
    sourceType: event.sourceType,
    externalId: event.sourceId,
    url: event.evidence?.[0]?.snapshot?.source?.rawUrl || "",
    title: event.title,
    titleHr: event.titleHr || undefined,
    occurredAt: event.occurredAt,
    impactLevel: event.impactLevel,
    sourceCount: event.evidence?.length || 1,
    topics: event.topics?.map((t: any) => t.topic?.slug || t.topicId) || [],
    status: event.status,
    headline: headlineArtifact?.payload?.en,
    summary: summaryArtifact?.payload?.en,
    gmTake: gmTakeArtifact?.payload?.take,
  };
}

export const eventsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        sourceType: SourceType.optional(),
        impactLevel: ImpactLevel.optional(),
        beforeTime: z.date().optional(),
        status: EventStatus.optional(),
        topicSlug: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        // Default: only show PUBLISHED events
        status: input.status || "PUBLISHED",
      };

      if (input.sourceType) {
        where.sourceType = input.sourceType;
      }

      if (input.impactLevel) {
        where.impactLevel = input.impactLevel;
      }

      if (input.beforeTime) {
        where.occurredAt = { lte: input.beforeTime };
      }

      if (input.topicSlug) {
        where.topics = {
          some: {
            topic: { slug: input.topicSlug },
          },
        };
      }

      const events = await ctx.db.event.findMany({
        where,
        include: {
          evidence: {
            take: 1,
            include: {
              snapshot: {
                include: { source: true },
              },
            },
          },
          topics: {
            include: { topic: true },
          },
          artifacts: {
            where: {
              artifactType: { in: ["HEADLINE", "SUMMARY", "GM_TAKE"] },
            },
          },
        },
        orderBy: { occurredAt: "desc" },
        take: input.limit + 1, // Fetch one extra to determine if there's more
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      });

      let nextCursor: string | null = null;
      if (events.length > input.limit) {
        const nextItem = events.pop();
        nextCursor = nextItem?.id || null;
      }

      return {
        items: events.map(toNormalizedEvent),
        nextCursor,
      };
    }),

  byId: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const event = await ctx.db.event.findUnique({
      where: { id: input },
      include: {
        evidence: {
          include: {
            snapshot: {
              include: { source: true },
            },
          },
        },
        topics: {
          include: { topic: true },
        },
        artifacts: true,
        mentions: {
          include: { entity: true },
        },
        statusHistory: {
          orderBy: { changedAt: "desc" },
          take: 5,
        },
      },
    });

    if (!event) {
      return null;
    }

    return {
      ...toNormalizedEvent(event),
      artifacts: event.artifacts.map((a) => ({
        type: a.artifactType,
        payload: a.payload,
        modelUsed: a.modelUsed,
        version: a.version,
      })),
      entities: event.mentions.map((m) => ({
        id: m.entity.id,
        name: m.entity.name,
        type: m.entity.type,
        role: m.role,
      })),
      statusHistory: event.statusHistory,
      evidence: event.evidence.map((e) => ({
        id: e.id,
        url: e.snapshot.source.rawUrl,
        domain: e.snapshot.source.domain,
        trustTier: e.snapshot.source.trustTier,
        retrievedAt: e.snapshot.retrievedAt,
      })),
    };
  }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Use PostgreSQL full-text search
      const events = await ctx.db.$queryRaw<any[]>`
        SELECT e.id, e.title, e."titleHr", e."occurredAt", e."impactLevel",
               e."sourceType", e."sourceId", e.status
        FROM events e
        WHERE e.status = 'PUBLISHED'
          AND e.search_vector @@ plainto_tsquery('english', ${input.query})
        ORDER BY ts_rank(e.search_vector, plainto_tsquery('english', ${input.query})) DESC
        LIMIT ${input.limit}
      `;

      return events.map((e) => ({
        id: e.id,
        title: e.title,
        titleHr: e.titleHr,
        occurredAt: e.occurredAt,
        impactLevel: e.impactLevel,
        sourceType: e.sourceType,
        externalId: e.sourceId,
        url: "",
        sourceCount: 1,
        topics: [],
        status: e.status,
      }));
    }),

  // Count events since a given date (for catch-up calculation)
  countSince: publicProcedure
    .input(
      z.object({
        since: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.event.count({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: input.since },
        },
      });

      return { count };
    }),

  // Get events mentioning a specific entity (for entity dossier pages)
  // Returns normalized events with mentions data for showing which entities
  // are referenced in each event. Uses same transformation as list() for
  // API consistency, but adds mentions array for dossier page requirements.
  byEntity: publicProcedure
    .input(
      z.object({
        entityId: z.string(),
        role: z.enum(["SUBJECT", "OBJECT", "MENTIONED"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await ctx.db.event.findMany({
        where: {
          status: "PUBLISHED",
          mentions: {
            some: {
              entityId: input.entityId,
              ...(input.role && { role: input.role }),
            },
          },
        },
        include: {
          evidence: {
            take: 1,
            include: {
              snapshot: {
                include: { source: true },
              },
            },
          },
          topics: {
            include: { topic: true },
          },
          artifacts: {
            where: { artifactType: { in: ["HEADLINE", "SUMMARY", "GM_TAKE"] } },
          },
          mentions: {
            include: { entity: true },
            take: 5,
          },
        },
        orderBy: { occurredAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });

      let nextCursor: string | null = null;
      if (events.length > input.limit) {
        const nextItem = events.pop();
        nextCursor = nextItem?.id ?? null;
      }

      return {
        items: events.map((event) => ({
          ...toNormalizedEvent(event),
          mentions: event.mentions.map((m) => ({
            id: m.entity.id,
            name: m.entity.name,
            type: m.entity.type,
            role: m.role,
          })),
        })),
        nextCursor,
      };
    }),
});
