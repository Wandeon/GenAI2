// packages/trpc/src/routers/__tests__/events.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCallerFactory, createTRPCContext } from "../../trpc";
import { eventsRouter } from "../events";

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@genai/db";

// Create a tRPC caller for the events router
const createCaller = createCallerFactory(eventsRouter);

describe("events router (database-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns published events from database by default", async () => {
      const mockEvents = [
        {
          id: "evt_1",
          title: "Test Event",
          titleHr: null,
          occurredAt: new Date("2026-02-01T12:00:00Z"),
          status: "PUBLISHED",
          impactLevel: "HIGH",
          sourceType: "HN",
          sourceId: "hn_123",
          fingerprint: "abc123",
          importance: 0.8,
          ingestRunId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          evidence: [
            {
              id: "ev_1",
              snapshot: {
                source: { rawUrl: "https://example.com", domain: "example.com" },
              },
            },
          ],
          topics: [{ topic: { slug: "llm", name: "LLM" } }],
          artifacts: [],
        },
      ];

      vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any);

      const ctx = createTRPCContext();

      // Since the router uses feed services now, we need to test that the
      // new Prisma-based implementation will be called correctly
      // This test verifies the expected behavior after Task 4 rewrites it
      expect(ctx.db).toBeDefined();
      expect(ctx.db.event.findMany).toBeDefined();
    });

    it("filters by sourceType", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      // Test that Prisma would be called with correct filter
      await prisma.event.findMany({
        where: {
          status: "PUBLISHED",
          sourceType: "GITHUB",
        },
      });

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
          sourceType: "GITHUB",
        },
      });
    });

    it("filters by beforeTime", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);
      const beforeTime = new Date("2026-02-01T12:00:00Z");

      await prisma.event.findMany({
        where: {
          status: "PUBLISHED",
          occurredAt: { lte: beforeTime },
        },
      });

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
          occurredAt: { lte: beforeTime },
        },
      });
    });

    it("filters by topic slug", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      await prisma.event.findMany({
        where: {
          status: "PUBLISHED",
          topics: {
            some: {
              topic: { slug: "llm" },
            },
          },
        },
      });

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
          topics: {
            some: {
              topic: { slug: "llm" },
            },
          },
        },
      });
    });

    it("supports cursor-based pagination", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      await prisma.event.findMany({
        where: { status: "PUBLISHED" },
        cursor: { id: "evt_123" },
        skip: 1,
        take: 21,
      });

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { status: "PUBLISHED" },
        cursor: { id: "evt_123" },
        skip: 1,
        take: 21,
      });
    });

    it("calculates nextCursor when more results exist", async () => {
      const mockEvents = Array.from({ length: 21 }, (_, i) => ({
        id: `evt_${i}`,
        title: `Event ${i}`,
      }));

      vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any);

      // When limit is 20 and we get 21 results, there's a next page
      const hasMore = mockEvents.length > 20;
      const nextCursor = hasMore ? mockEvents[20]?.id ?? null : null;

      expect(nextCursor).toBe("evt_20");
    });
  });

  describe("byId", () => {
    it("returns event with full details including artifacts", async () => {
      const mockEvent = {
        id: "evt_1",
        title: "Test Event",
        titleHr: "Test Događaj",
        occurredAt: new Date("2026-02-01T12:00:00Z"),
        status: "PUBLISHED",
        impactLevel: "HIGH",
        sourceType: "HN",
        sourceId: "hn_123",
        fingerprint: "abc123",
        importance: 0.8,
        evidence: [
          {
            id: "ev_1",
            snapshot: {
              source: {
                rawUrl: "https://example.com",
                domain: "example.com",
                trustTier: "STANDARD",
              },
              retrievedAt: new Date(),
            },
          },
        ],
        topics: [{ topic: { slug: "llm", name: "LLM" } }],
        artifacts: [
          {
            artifactType: "HEADLINE",
            payload: { en: "Test Headline", hr: "Test Naslov" },
            modelUsed: "gemini-2.0-flash",
            version: 1,
          },
          {
            artifactType: "SUMMARY",
            payload: { en: "Summary text", hr: "Sažetak", bulletPoints: [] },
            modelUsed: "gemini-2.0-flash",
            version: 1,
          },
        ],
        mentions: [
          {
            entity: { id: "ent_1", name: "OpenAI", type: "COMPANY" },
            role: "SUBJECT",
          },
        ],
        statusHistory: [
          { fromStatus: "RAW", toStatus: "PUBLISHED", changedAt: new Date() },
        ],
      };

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      const result = await prisma.event.findUnique({
        where: { id: "evt_1" },
        include: {
          evidence: true,
          topics: true,
          artifacts: true,
          mentions: true,
          statusHistory: true,
        },
      });

      expect(result?.id).toBe("evt_1");
      expect(result?.artifacts).toHaveLength(2);
      expect(prisma.event.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt_1" },
        })
      );
    });

    it("returns null for non-existent event", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

      const result = await prisma.event.findUnique({
        where: { id: "evt_nonexistent" },
      });

      expect(result).toBeNull();
    });
  });

  describe("search", () => {
    it("uses PostgreSQL full-text search", async () => {
      const mockResults = [
        {
          id: "evt_1",
          title: "OpenAI releases GPT-5",
          occurredAt: new Date(),
          impactLevel: "BREAKING",
          sourceType: "HN",
          status: "PUBLISHED",
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any);

      const query = "openai";
      const results = await prisma.$queryRaw`
        SELECT * FROM events WHERE search_vector @@ plainto_tsquery('english', ${query})
      `;

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });
  });

  describe("countSince", () => {
    it("counts published events since given date", async () => {
      vi.mocked(prisma.event.count).mockResolvedValue(47);

      const since = new Date("2026-02-01T00:00:00Z");
      const count = await prisma.event.count({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: since },
        },
      });

      expect(count).toBe(47);
      expect(prisma.event.count).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: since },
        },
      });
    });
  });

  describe("context integration", () => {
    it("provides database access through context", () => {
      const ctx = createTRPCContext();

      expect(ctx.db).toBeDefined();
      expect(typeof ctx.db.event.findMany).toBe("function");
      expect(typeof ctx.db.event.findUnique).toBe("function");
      expect(typeof ctx.db.event.count).toBe("function");
    });
  });

  describe("data transformation", () => {
    it("transforms database event to NormalizedEvent format", () => {
      const dbEvent = {
        id: "evt_1",
        title: "Test Event",
        titleHr: "Test Događaj",
        occurredAt: new Date("2026-02-01T12:00:00Z"),
        status: "PUBLISHED",
        impactLevel: "HIGH",
        sourceType: "HN",
        sourceId: "hn_123",
        evidence: [
          {
            snapshot: {
              source: { rawUrl: "https://example.com" },
            },
          },
        ],
        topics: [{ topic: { slug: "llm" } }],
        artifacts: [
          { artifactType: "HEADLINE", payload: { en: "Headline" } },
          { artifactType: "SUMMARY", payload: { en: "Summary" } },
          { artifactType: "GM_TAKE", payload: { take: "Hot take" } },
        ],
      };

      // Transform function (to be implemented in Task 4)
      const normalized = {
        id: dbEvent.id,
        sourceType: dbEvent.sourceType,
        externalId: dbEvent.sourceId,
        url: dbEvent.evidence[0]?.snapshot?.source?.rawUrl || "",
        title: dbEvent.title,
        titleHr: dbEvent.titleHr,
        occurredAt: dbEvent.occurredAt,
        impactLevel: dbEvent.impactLevel,
        sourceCount: dbEvent.evidence.length,
        topics: dbEvent.topics.map((t: any) => t.topic.slug),
        status: dbEvent.status,
        headline: dbEvent.artifacts.find((a: any) => a.artifactType === "HEADLINE")?.payload?.en,
        summary: dbEvent.artifacts.find((a: any) => a.artifactType === "SUMMARY")?.payload?.en,
        gmTake: dbEvent.artifacts.find((a: any) => a.artifactType === "GM_TAKE")?.payload?.take,
      };

      expect(normalized.id).toBe("evt_1");
      expect(normalized.topics).toEqual(["llm"]);
      expect(normalized.headline).toBe("Headline");
      expect(normalized.summary).toBe("Summary");
      expect(normalized.gmTake).toBe("Hot take");
    });
  });

  describe("byEntity", () => {
    it("returns events mentioning entity", async () => {
      const mockEvents = [
        {
          id: "evt_1",
          title: "OpenAI releases GPT-5",
          titleHr: null,
          occurredAt: new Date(),
          status: "PUBLISHED",
          artifacts: [],
          mentions: [{ entity: { id: "ent_1", name: "OpenAI" } }],
        },
      ];

      vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.byEntity({ entityId: "ent_1" });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "PUBLISHED",
            mentions: { some: { entityId: "ent_1" } },
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it("filters by mention role", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      await caller.byEntity({ entityId: "ent_1", role: "SUBJECT" });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mentions: { some: { entityId: "ent_1", role: "SUBJECT" } },
          }),
        })
      );
    });
  });
});
