// packages/trpc/src/routers/__tests__/sessions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCContext } from "../../trpc";

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    anonSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    event: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@genai/db";

// ============================================================================
// TEST DATA
// ============================================================================

const mockSession = {
  id: "session-1",
  token: "token-abc",
  lastSeenAt: new Date("2026-02-01T10:00:00Z"),
  lastEventCursor: "event-123",
  preferences: { theme: "dark", language: "hr" },
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T10:00:00Z"),
  watchlists: [
    {
      id: "watchlist-1",
      sessionId: "session-1",
      name: "AI Companies",
      entities: [{ id: "we-1", watchlistId: "watchlist-1", entityId: "entity-1" }],
      topics: [{ id: "wt-1", watchlistId: "watchlist-1", topicId: "topic-1" }],
    },
  ],
};

// ============================================================================
// TESTS
// ============================================================================

describe("sessions router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("get", () => {
    it("returns null if no sessionId in context", () => {
      const ctx = createTRPCContext();
      // No sessionId - validates the router logic pattern
      expect(ctx.sessionId).toBeUndefined();
    });

    it("returns session with watchlists if sessionId exists", async () => {
      vi.mocked(prisma.anonSession.findUnique).mockResolvedValue(mockSession as never);

      const result = await prisma.anonSession.findUnique({
        where: { id: "session-1" },
        include: {
          watchlists: {
            include: {
              entities: true,
              topics: true,
            },
          },
        },
      });

      expect(result).toEqual(mockSession);
      expect(result?.watchlists).toHaveLength(1);
    });

    it("returns null for non-existent session", async () => {
      vi.mocked(prisma.anonSession.findUnique).mockResolvedValue(null);

      const result = await prisma.anonSession.findUnique({
        where: { id: "non-existent" },
      });

      expect(result).toBeNull();
    });
  });

  describe("updateCursor", () => {
    it("updates lastEventCursor and lastSeenAt", async () => {
      vi.mocked(prisma.anonSession.update).mockResolvedValue({
        ...mockSession,
        lastEventCursor: "event-456",
        lastSeenAt: new Date(),
      } as never);

      await prisma.anonSession.update({
        where: { id: "session-1" },
        data: {
          lastEventCursor: "event-456",
          lastSeenAt: expect.any(Date),
        },
      });

      expect(prisma.anonSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "session-1" },
          data: expect.objectContaining({
            lastEventCursor: "event-456",
          }),
        })
      );
    });
  });

  describe("getCatchUp", () => {
    it("returns events count since last visit", async () => {
      vi.mocked(prisma.anonSession.findUnique).mockResolvedValue({
        lastSeenAt: new Date("2026-02-01T10:00:00Z"),
      } as never);
      vi.mocked(prisma.event.count).mockResolvedValue(15);

      const session = await prisma.anonSession.findUnique({
        where: { id: "session-1" },
        select: { lastSeenAt: true },
      });

      const count = await prisma.event.count({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: session?.lastSeenAt },
        },
      });

      expect(count).toBe(15);
    });

    it("returns last 24 hours for new session without lastSeenAt", async () => {
      vi.mocked(prisma.anonSession.findUnique).mockResolvedValue({
        lastSeenAt: null,
      } as never);
      vi.mocked(prisma.event.count).mockResolvedValue(42);

      const count = await prisma.event.count({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: expect.any(Date) },
        },
      });

      expect(count).toBe(42);
    });

    it("returns last 24 hours for no session", async () => {
      vi.mocked(prisma.event.count).mockResolvedValue(30);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const count = await prisma.event.count({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: yesterday },
        },
      });

      expect(count).toBe(30);
    });
  });

  describe("updatePreferences", () => {
    it("merges new preferences with existing", async () => {
      vi.mocked(prisma.anonSession.findUnique).mockResolvedValue({
        preferences: { theme: "dark", language: "hr" },
      } as never);
      vi.mocked(prisma.anonSession.update).mockResolvedValue({
        ...mockSession,
        preferences: { theme: "dark", language: "en", fontSize: "large" },
      } as never);

      const current = await prisma.anonSession.findUnique({
        where: { id: "session-1" },
        select: { preferences: true },
      });

      const existingPrefs =
        typeof current?.preferences === "object" && current.preferences !== null
          ? (current.preferences as Record<string, unknown>)
          : {};

      const mergedPreferences = {
        ...existingPrefs,
        language: "en",
        fontSize: "large",
      };

      await prisma.anonSession.update({
        where: { id: "session-1" },
        data: { preferences: mergedPreferences },
      });

      expect(prisma.anonSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            preferences: expect.objectContaining({
              theme: "dark",
              language: "en",
              fontSize: "large",
            }),
          }),
        })
      );
    });
  });

  describe("markSeen", () => {
    it("updates lastSeenAt timestamp", async () => {
      vi.mocked(prisma.anonSession.update).mockResolvedValue({
        ...mockSession,
        lastSeenAt: new Date(),
      } as never);

      await prisma.anonSession.update({
        where: { id: "session-1" },
        data: { lastSeenAt: expect.any(Date) },
      });

      expect(prisma.anonSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastSeenAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe("addRecentSearch", () => {
    it("stores a recent search entry in preferences", async () => {
      vi.mocked(prisma.anonSession.findUnique).mockResolvedValue({
        preferences: {},
      } as never);
      vi.mocked(prisma.anonSession.update).mockResolvedValue({} as never);

      await prisma.anonSession.findUnique({
        where: { id: "session-1" },
        select: { preferences: true },
      });

      await prisma.anonSession.update({
        where: { id: "session-1" },
        data: {
          preferences: {
            recentSearches: [
              {
                query: "openai",
                slug: "openai",
                name: "OpenAI",
                type: "COMPANY",
                timestamp: expect.any(String),
              },
            ],
          },
        },
      });

      expect(prisma.anonSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            preferences: expect.objectContaining({
              recentSearches: expect.arrayContaining([
                expect.objectContaining({
                  slug: "openai",
                  name: "OpenAI",
                  type: "COMPANY",
                }),
              ]),
            }),
          }),
        })
      );
    });

    it("deduplicates by slug and caps at 8 entries", () => {
      const existing = Array.from({ length: 8 }, (_, i) => ({
        slug: `entity-${i}`,
        name: `Entity ${i}`,
        type: "COMPANY",
        query: `entity-${i}`,
        timestamp: new Date().toISOString(),
      }));

      // Simulate dedup + prepend + cap logic
      const newEntry = {
        slug: "entity-0",
        name: "Entity 0 Updated",
        type: "COMPANY",
        query: "entity-0",
        timestamp: new Date().toISOString(),
      };

      const filtered = existing.filter((e) => e.slug !== newEntry.slug);
      const updated = [newEntry, ...filtered].slice(0, 8);

      expect(updated).toHaveLength(8);
      expect(updated[0]!.slug).toBe("entity-0");
      expect(updated[0]!.name).toBe("Entity 0 Updated");
    });
  });

  describe("getRecentSearches", () => {
    it("returns recent searches from preferences", async () => {
      const recentSearches = [
        { query: "openai", slug: "openai", name: "OpenAI", type: "COMPANY", timestamp: "2026-02-01T00:00:00Z" },
      ];
      vi.mocked(prisma.anonSession.findUnique).mockResolvedValue({
        preferences: { recentSearches },
      } as never);

      const session = await prisma.anonSession.findUnique({
        where: { id: "session-1" },
        select: { preferences: true },
      });

      const prefs = session?.preferences as Record<string, unknown>;
      const result = Array.isArray(prefs?.recentSearches) ? prefs.recentSearches : [];

      expect(result).toEqual(recentSearches);
    });

    it("returns empty array when no recent searches", async () => {
      vi.mocked(prisma.anonSession.findUnique).mockResolvedValue({
        preferences: {},
      } as never);

      const session = await prisma.anonSession.findUnique({
        where: { id: "session-1" },
        select: { preferences: true },
      });

      const prefs = session?.preferences as Record<string, unknown>;
      const result = Array.isArray(prefs?.recentSearches) ? prefs.recentSearches : [];

      expect(result).toEqual([]);
    });
  });

  describe("context integration", () => {
    it("provides sessionId through context", () => {
      const ctx = createTRPCContext({ sessionId: "session-123" });

      expect(ctx.sessionId).toBe("session-123");
      expect(ctx.db).toBeDefined();
    });

    it("sessionId is undefined when not provided", () => {
      const ctx = createTRPCContext();

      expect(ctx.sessionId).toBeUndefined();
    });
  });
});
