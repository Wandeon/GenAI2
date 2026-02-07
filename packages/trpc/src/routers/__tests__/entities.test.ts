// packages/trpc/src/routers/__tests__/entities.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCallerFactory, createTRPCContext } from "../../trpc";
import { entitiesRouter } from "../entities";

// Mock Prisma - must be before importing anything that uses it
vi.mock("@genai/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@genai/db")>();
  return {
    ...actual,
    prisma: {
      entity: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      relationship: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
  };
});

import { prisma } from "@genai/db";

// ============================================================================
// TEST SETUP
// ============================================================================

// Create a tRPC caller for the entities router
const createCaller = createCallerFactory(entitiesRouter);

// ============================================================================
// TEST DATA
// ============================================================================

const mockEntity = {
  id: "ent_1",
  name: "OpenAI",
  nameHr: null,
  slug: "openai",
  type: "COMPANY",
  description: "AI research company",
  descriptionHr: null,
  importance: 0.9,
  firstSeen: new Date("2026-01-01T00:00:00Z"),
  lastSeen: new Date("2026-02-01T00:00:00Z"),
  aliases: [{ id: "a1", entityId: "ent_1", alias: "Open AI" }],
  _count: { mentions: 42, sourceRels: 5, targetRels: 3 },
};

// ============================================================================
// TESTS
// ============================================================================

describe("entities router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("bySlug", () => {
    it("returns entity with aliases and counts", async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(mockEntity as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);

      const result = await caller.bySlug("openai");

      expect(result).toEqual(mockEntity);
      expect(result?.aliases).toHaveLength(1);
      expect(result?._count.mentions).toBe(42);
      expect(prisma.entity.findUnique).toHaveBeenCalledWith({
        where: { slug: "openai" },
        include: {
          aliases: true,
          _count: { select: { mentions: true, sourceRels: true, targetRels: true } },
        },
      });
    });

    it("returns null for non-existent slug", async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(null);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);

      const result = await caller.bySlug("nonexistent");

      expect(result).toBeNull();
      expect(prisma.entity.findUnique).toHaveBeenCalledWith({
        where: { slug: "nonexistent" },
        include: {
          aliases: true,
          _count: { select: { mentions: true, sourceRels: true, targetRels: true } },
        },
      });
    });

    it("includes all required entity fields", async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(mockEntity as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);

      const result = await caller.bySlug("openai");

      expect(result).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        type: expect.any(String),
        importance: expect.any(Number),
        firstSeen: expect.any(Date),
        lastSeen: expect.any(Date),
      });
    });
  });

  describe("context integration", () => {
    it("provides database access through context", () => {
      const ctx = createTRPCContext();

      expect(ctx.db).toBeDefined();
      expect(typeof ctx.db.entity.findUnique).toBe("function");
      expect(typeof ctx.db.entity.findMany).toBe("function");
    });
  });

  describe("fuzzySearch", () => {
    it("searches by name case-insensitive", async () => {
      vi.mocked(prisma.entity.findMany).mockResolvedValue([mockEntity] as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.fuzzySearch({ query: "open" });

      expect(prisma.entity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: "open", mode: "insensitive" } },
            ]),
          }),
        })
      );
      expect(result).toEqual([mockEntity]);
    });

    it("filters by entity type", async () => {
      vi.mocked(prisma.entity.findMany).mockResolvedValue([]);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      await caller.fuzzySearch({ query: "test", types: ["COMPANY", "LAB"] });

      expect(prisma.entity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: ["COMPANY", "LAB"] },
          }),
        })
      );
    });

    it("returns empty array for no matches", async () => {
      vi.mocked(prisma.entity.findMany).mockResolvedValue([]);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.fuzzySearch({ query: "zzz" });

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // RELATED ENTITIES TESTS
  // ============================================================================

  const mockRelationships = [
    {
      id: "rel_1",
      sourceId: "ent_1",
      targetId: "ent_2",
      type: "RELEASED",
      status: "APPROVED",
      source: { id: "ent_1", name: "OpenAI", type: "COMPANY", slug: "openai" },
      target: { id: "ent_2", name: "GPT-4", type: "MODEL", slug: "gpt-4" },
    },
    {
      id: "rel_2",
      sourceId: "ent_3",
      targetId: "ent_1",
      type: "FUNDED",
      status: "APPROVED",
      source: { id: "ent_3", name: "Microsoft", type: "COMPANY", slug: "microsoft" },
      target: { id: "ent_1", name: "OpenAI", type: "COMPANY", slug: "openai" },
    },
  ];

  describe("related", () => {
    it("returns related entities with connection counts", async () => {
      vi.mocked(prisma.relationship.findMany).mockResolvedValue(mockRelationships as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.related({ entityId: "ent_1" });

      expect(prisma.relationship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ sourceId: "ent_1" }, { targetId: "ent_1" }],
            status: "APPROVED",
          }),
        })
      );
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no relationships", async () => {
      vi.mocked(prisma.relationship.findMany).mockResolvedValue([]);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.related({ entityId: "ent_999" });

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // TOP BY MENTIONS TESTS
  // ============================================================================

  describe("topByMentions", () => {
    it("returns entities ordered by importance", async () => {
      const topEntities = [
        { id: "ent_1", name: "OpenAI", slug: "openai", type: "COMPANY" },
        { id: "ent_2", name: "Anthropic", slug: "anthropic", type: "COMPANY" },
      ];
      vi.mocked(prisma.entity.findMany).mockResolvedValue(topEntities as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.topByMentions({ limit: 5 });

      expect(prisma.entity.findMany).toHaveBeenCalledWith({
        orderBy: { importance: "desc" },
        take: 5,
        select: { id: true, name: true, slug: true, type: true },
      });
      expect(result).toEqual(topEntities);
    });

    it("uses default limit of 5", async () => {
      vi.mocked(prisma.entity.findMany).mockResolvedValue([]);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      await caller.topByMentions({});

      expect(prisma.entity.findMany).toHaveBeenCalledWith({
        orderBy: { importance: "desc" },
        take: 5,
        select: { id: true, name: true, slug: true, type: true },
      });
    });
  });

  // ============================================================================
  // GRAPH DATA TESTS
  // ============================================================================

  describe("graphData", () => {
    it("returns nodes and links for entity relationships", async () => {
      vi.mocked(prisma.relationship.findMany).mockResolvedValue(mockRelationships as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.graphData({ entityId: "ent_1", maxNodes: 30 });

      expect(result.nodes).toHaveLength(3);
      expect(result.links).toHaveLength(2);
      expect(result.nodes).toEqual(
        expect.arrayContaining([
          { id: "ent_1", name: "OpenAI", type: "COMPANY", slug: "openai" },
          { id: "ent_2", name: "GPT-4", type: "MODEL", slug: "gpt-4" },
          { id: "ent_3", name: "Microsoft", type: "COMPANY", slug: "microsoft" },
        ])
      );
      expect(result.links).toEqual(
        expect.arrayContaining([
          { source: "ent_1", target: "ent_2", type: "RELEASED" },
          { source: "ent_3", target: "ent_1", type: "FUNDED" },
        ])
      );
    });

    it("filters by relationshipTypes in the query", async () => {
      const releasedOnly = [mockRelationships[0]];
      vi.mocked(prisma.relationship.findMany).mockResolvedValue(releasedOnly as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.graphData({
        entityId: "ent_1",
        maxNodes: 30,
        relationshipTypes: ["RELEASED"],
      });

      expect(prisma.relationship.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ sourceId: "ent_1" }, { targetId: "ent_1" }],
          status: "APPROVED",
          type: { in: ["RELEASED"] },
        },
        include: { source: true, target: true },
        take: 30,
      });
      expect(result.nodes).toHaveLength(2);
      expect(result.links).toHaveLength(1);
    });

    it("filters by entityTypes, keeping the queried entity", async () => {
      vi.mocked(prisma.relationship.findMany).mockResolvedValue(mockRelationships as never);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.graphData({
        entityId: "ent_1",
        maxNodes: 30,
        entityTypes: ["MODEL"],
      });

      // ent_1 (COMPANY) is kept because it's the queried entity
      // ent_2 (MODEL) passes the filter
      // ent_3 (COMPANY) is removed by the filter
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain("ent_1");
      expect(result.nodes.map((n) => n.id)).toContain("ent_2");
      expect(result.nodes.map((n) => n.id)).not.toContain("ent_3");
      // Link ent_3 -> ent_1 is removed because ent_3 was filtered out
      expect(result.links).toHaveLength(1);
      expect(result.links[0]).toEqual({
        source: "ent_1",
        target: "ent_2",
        type: "RELEASED",
      });
    });

    it("returns empty graph for entity with no relationships", async () => {
      vi.mocked(prisma.relationship.findMany).mockResolvedValue([]);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.graphData({ entityId: "ent_999", maxNodes: 30 });

      expect(result.nodes).toEqual([]);
      expect(result.links).toEqual([]);
    });
  });

  // ============================================================================
  // MENTION VELOCITY TESTS
  // ============================================================================

  describe("mentionVelocity", () => {
    it("returns date/count pairs for entity mentions", async () => {
      const mockRows = [
        { date: "2026-02-01", count: 5 },
        { date: "2026-02-02", count: 3 },
        { date: "2026-02-03", count: 8 },
      ];
      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockRows);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.mentionVelocity({ entityId: "ent_1", days: 7 });

      expect(result.data).toEqual(mockRows);
      expect(result.data).toHaveLength(3);
      expect(result.data[0]!.date).toBe("2026-02-01");
      expect(result.data[0]!.count).toBe(5);
      expect(result.data[2]!.date).toBe("2026-02-03");
      expect(result.data[2]!.count).toBe(8);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("returns empty data for entity with no mentions", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      const result = await caller.mentionVelocity({ entityId: "ent_999", days: 7 });

      expect(result.data).toEqual([]);
      expect(result.data).toHaveLength(0);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("passes entityId and computed since date to the query", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const ctx = createTRPCContext();
      const caller = createCaller(ctx);
      await caller.mentionVelocity({ entityId: "ent_1", days: 30 });

      // $queryRaw is called as tagged template: $queryRaw`...${entityId}...${since}...`
      // Mock receives (TemplateStringsArray, entityId, sinceDate)
      const callArgs = vi.mocked(prisma.$queryRaw).mock.calls[0]!;
      expect(callArgs[1]).toBe("ent_1");

      const sinceDate = callArgs[2] as Date;
      expect(sinceDate).toBeInstanceOf(Date);

      // With days=30, sinceDate should be ~30 days ago
      const expectedSince = new Date();
      expectedSince.setDate(expectedSince.getDate() - 30);
      expect(Math.abs(sinceDate.getTime() - expectedSince.getTime())).toBeLessThan(60_000);
    });
  });
});
