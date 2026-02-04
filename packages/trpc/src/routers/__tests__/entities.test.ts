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
});
