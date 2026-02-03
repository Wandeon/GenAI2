import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  matchWatchlists,
  checkEntityMatches,
  checkTopicMatches,
  checkKeywordMatches,
  findAllMatches,
  hasAnyCriteria,
} from "../watchlist-match";
import { prisma } from "@genai/db";

// ============================================================================
// WATCHLIST MATCH PROCESSOR TESTS
// ============================================================================
// Tests for Phase 2: Event Pipeline - Task 88
// Implements TDD - tests written before implementation

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    watchlist: {
      findMany: vi.fn(),
    },
    watchlistMatch: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Helper to create mock event with relations
function createMockEvent(overrides = {}) {
  return {
    id: "event-123",
    title: "OpenAI releases GPT-5 with breakthrough capabilities",
    status: "PUBLISHED",
    mentions: [
      {
        entityId: "entity-openai",
        entity: { id: "entity-openai", name: "OpenAI" },
      },
      {
        entityId: "entity-gpt5",
        entity: { id: "entity-gpt5", name: "GPT-5" },
      },
    ],
    topics: [
      {
        topicId: "topic-llm",
        topic: { id: "topic-llm", name: "Large Language Models" },
      },
      {
        topicId: "topic-release",
        topic: { id: "topic-release", name: "Product Release" },
      },
    ],
    ...overrides,
  };
}

// Helper to create mock watchlist
function createMockWatchlist(overrides = {}) {
  return {
    id: "watchlist-1",
    name: "AI Companies",
    entities: [],
    topics: [],
    keywords: [],
    ...overrides,
  };
}

describe("watchlist-match processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("utility functions", () => {
    describe("checkEntityMatches", () => {
      it("returns matches for entities in both event and watchlist", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          entities: [{ entityId: "entity-openai" }],
        });

        const matches = checkEntityMatches(event, watchlist);

        expect(matches).toHaveLength(1);
        expect(matches[0]).toEqual({
          watchlistId: "watchlist-1",
          matchType: "ENTITY",
          matchedValue: "OpenAI",
        });
      });

      it("returns empty array when no entity matches", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          entities: [{ entityId: "entity-google" }],
        });

        const matches = checkEntityMatches(event, watchlist);

        expect(matches).toHaveLength(0);
      });

      it("returns multiple matches for multiple matching entities", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          entities: [{ entityId: "entity-openai" }, { entityId: "entity-gpt5" }],
        });

        const matches = checkEntityMatches(event, watchlist);

        expect(matches).toHaveLength(2);
      });
    });

    describe("checkTopicMatches", () => {
      it("returns matches for topics in both event and watchlist", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          topics: [{ topicId: "topic-llm" }],
        });

        const matches = checkTopicMatches(event, watchlist);

        expect(matches).toHaveLength(1);
        expect(matches[0]).toEqual({
          watchlistId: "watchlist-1",
          matchType: "TOPIC",
          matchedValue: "Large Language Models",
        });
      });

      it("returns empty array when no topic matches", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          topics: [{ topicId: "topic-regulation" }],
        });

        const matches = checkTopicMatches(event, watchlist);

        expect(matches).toHaveLength(0);
      });
    });

    describe("checkKeywordMatches", () => {
      it("returns matches for keywords found in event title", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          keywords: ["GPT-5"],
        });

        const matches = checkKeywordMatches(event, watchlist);

        expect(matches).toHaveLength(1);
        expect(matches[0]).toEqual({
          watchlistId: "watchlist-1",
          matchType: "KEYWORD",
          matchedValue: "GPT-5",
        });
      });

      it("performs case-insensitive matching", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          keywords: ["openai", "BREAKTHROUGH"],
        });

        const matches = checkKeywordMatches(event, watchlist);

        expect(matches).toHaveLength(2);
      });

      it("returns empty array when no keyword matches", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          keywords: ["Google", "Gemini"],
        });

        const matches = checkKeywordMatches(event, watchlist);

        expect(matches).toHaveLength(0);
      });
    });

    describe("findAllMatches", () => {
      it("combines entity, topic, and keyword matches", () => {
        const event = createMockEvent();
        const watchlist = createMockWatchlist({
          entities: [{ entityId: "entity-openai" }],
          topics: [{ topicId: "topic-llm" }],
          keywords: ["breakthrough"],
        });

        const matches = findAllMatches(event, watchlist);

        expect(matches).toHaveLength(3);
        expect(matches.map((m) => m.matchType)).toContain("ENTITY");
        expect(matches.map((m) => m.matchType)).toContain("TOPIC");
        expect(matches.map((m) => m.matchType)).toContain("KEYWORD");
      });
    });

    describe("hasAnyCriteria", () => {
      it("returns true when watchlist has entities", () => {
        const watchlist = createMockWatchlist({
          entities: [{ entityId: "entity-1" }],
        });

        expect(hasAnyCriteria(watchlist)).toBe(true);
      });

      it("returns true when watchlist has topics", () => {
        const watchlist = createMockWatchlist({
          topics: [{ topicId: "topic-1" }],
        });

        expect(hasAnyCriteria(watchlist)).toBe(true);
      });

      it("returns true when watchlist has keywords", () => {
        const watchlist = createMockWatchlist({
          keywords: ["keyword"],
        });

        expect(hasAnyCriteria(watchlist)).toBe(true);
      });

      it("returns false when watchlist has no criteria", () => {
        const watchlist = createMockWatchlist();

        expect(hasAnyCriteria(watchlist)).toBe(false);
      });
    });
  });

  describe("matchWatchlists", () => {
    describe("entity matching", () => {
      it("matches event to watchlist by entity", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const mockWatchlist = createMockWatchlist({
          entities: [{ entityId: "entity-openai" }],
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([mockWatchlist] as never);
          vi.mocked(prisma.watchlistMatch.upsert).mockResolvedValue({
            id: "match-1",
            watchlistId: mockWatchlist.id,
            eventId: mockEvent.id,
            seen: false,
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        expect(result.matchesCreated).toBe(1);
        expect(prisma.watchlistMatch.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              watchlistId: mockWatchlist.id,
              eventId: mockEvent.id,
              seen: false,
            }),
          })
        );
      });
    });

    describe("topic matching", () => {
      it("matches event to watchlist by topic", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const mockWatchlist = createMockWatchlist({
          topics: [{ topicId: "topic-llm" }],
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([mockWatchlist] as never);
          vi.mocked(prisma.watchlistMatch.upsert).mockResolvedValue({
            id: "match-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        expect(result.matchesCreated).toBe(1);
      });
    });

    describe("keyword matching", () => {
      it("matches event to watchlist by keyword", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const mockWatchlist = createMockWatchlist({
          keywords: ["GPT-5"],
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([mockWatchlist] as never);
          vi.mocked(prisma.watchlistMatch.upsert).mockResolvedValue({
            id: "match-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        expect(result.matchesCreated).toBe(1);
      });
    });

    describe("notification (seen flag)", () => {
      it("creates unseen match for notification (seen: false)", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const mockWatchlist = createMockWatchlist({
          entities: [{ entityId: "entity-openai" }],
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([mockWatchlist] as never);
          vi.mocked(prisma.watchlistMatch.upsert).mockResolvedValue({
            id: "match-1",
            seen: false,
          } as never);

          return callback(prisma);
        });

        // Act
        await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(prisma.watchlistMatch.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              seen: false,
            }),
          })
        );
      });
    });

    describe("error handling", () => {
      it("handles event not found error", async () => {
        // Arrange
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: "non-existent" });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
        expect(result.matchesCreated).toBe(0);
      });

      it("skips events not in PUBLISHED status", async () => {
        // Arrange
        const mockEvent = createMockEvent({ status: "ENRICHED" });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toContain("not in PUBLISHED status");
        expect(result.matchesCreated).toBe(0);
      });
    });

    describe("no matching watchlists", () => {
      it("handles no matching watchlists", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const mockWatchlist = createMockWatchlist({
          entities: [{ entityId: "entity-google" }], // Different entity
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([mockWatchlist] as never);

          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        expect(result.matchesCreated).toBe(0);
        expect(prisma.watchlistMatch.upsert).not.toHaveBeenCalled();
      });
    });

    describe("watchlist with no criteria", () => {
      it("handles watchlist with no criteria", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const mockWatchlist = createMockWatchlist(); // No criteria

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([mockWatchlist] as never);

          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        expect(result.matchesCreated).toBe(0);
        expect(prisma.watchlistMatch.upsert).not.toHaveBeenCalled();
      });
    });

    describe("multiple matches", () => {
      it("handles multiple matches from different criteria", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const watchlistWithEntity = createMockWatchlist({
          id: "watchlist-entity",
          entities: [{ entityId: "entity-openai" }],
        });
        const watchlistWithTopic = createMockWatchlist({
          id: "watchlist-topic",
          topics: [{ topicId: "topic-llm" }],
        });
        const watchlistWithKeyword = createMockWatchlist({
          id: "watchlist-keyword",
          keywords: ["breakthrough"],
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([
            watchlistWithEntity,
            watchlistWithTopic,
            watchlistWithKeyword,
          ] as never);
          vi.mocked(prisma.watchlistMatch.upsert).mockResolvedValue({
            id: "match-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        expect(result.matchesCreated).toBe(3);
        expect(prisma.watchlistMatch.upsert).toHaveBeenCalledTimes(3);
      });

      it("creates single match per watchlist even with multiple criteria matches", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const watchlistWithMultipleCriteria = createMockWatchlist({
          id: "watchlist-multi",
          entities: [{ entityId: "entity-openai" }],
          topics: [{ topicId: "topic-llm" }],
          keywords: ["GPT-5"],
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([
            watchlistWithMultipleCriteria,
          ] as never);
          vi.mocked(prisma.watchlistMatch.upsert).mockResolvedValue({
            id: "match-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        // Only one match record per watchlist, not three
        expect(result.matchesCreated).toBe(1);
        expect(prisma.watchlistMatch.upsert).toHaveBeenCalledTimes(1);
      });
    });

    describe("idempotency", () => {
      it("uses upsert to handle duplicate matches", async () => {
        // Arrange
        const mockEvent = createMockEvent();
        const mockWatchlist = createMockWatchlist({
          entities: [{ entityId: "entity-openai" }],
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([mockWatchlist] as never);
          vi.mocked(prisma.watchlistMatch.upsert).mockResolvedValue({
            id: "match-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await matchWatchlists({ eventId: mockEvent.id });

        // Assert - should use upsert with unique constraint
        expect(prisma.watchlistMatch.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              watchlistId_eventId: {
                watchlistId: mockWatchlist.id,
                eventId: mockEvent.id,
              },
            },
          })
        );
      });
    });

    describe("no watchlists exist", () => {
      it("handles case when no watchlists exist", async () => {
        // Arrange
        const mockEvent = createMockEvent();

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.watchlist.findMany).mockResolvedValue([] as never);

          return callback(prisma);
        });

        // Act
        const result = await matchWatchlists({ eventId: mockEvent.id });

        // Assert
        expect(result.success).toBe(true);
        expect(result.matchesCreated).toBe(0);
      });
    });
  });
});
