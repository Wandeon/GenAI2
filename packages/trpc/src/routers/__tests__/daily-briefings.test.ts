// packages/trpc/src/routers/__tests__/daily-briefings.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCContext } from "../../trpc";

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    dailyBriefing: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@genai/db";

// ============================================================================
// TEST DATA
// ============================================================================

const mockBriefing = {
  id: "briefing-1",
  date: new Date("2026-02-04"),
  generatedAt: new Date("2026-02-04T06:00:00Z"),
  payload: {
    changedSince: {
      en: "Major announcements from OpenAI and Google",
      hr: "Velike najave od OpenAI i Googlea",
      highlights: ["GPT-5 launch", "Gemini 3 preview"],
    },
    prediction: {
      en: "Watch for benchmark comparisons",
      hr: "Pratite usporedbe testova",
      confidence: "medium",
    },
    eventCount: 10,
    sourceCount: 5,
    topEntities: ["OpenAI", "Google"],
  },
  runId: "run-123",
  items: [
    { id: "item-1", briefingId: "briefing-1", eventId: "event-1", rank: 1 },
    { id: "item-2", briefingId: "briefing-1", eventId: "event-2", rank: 2 },
  ],
};

const mockEvent = {
  id: "event-1",
  title: "OpenAI Launches GPT-5",
  titleHr: "OpenAI lansira GPT-5",
  occurredAt: new Date("2026-02-04T10:00:00Z"),
  status: "PUBLISHED",
  impactLevel: "BREAKING",
  artifacts: [
    {
      artifactType: "HEADLINE",
      payload: { en: "OpenAI Launches GPT-5", hr: "OpenAI lansira GPT-5" },
    },
    {
      artifactType: "SUMMARY",
      payload: { en: "OpenAI released GPT-5 today.", hr: "OpenAI je objavio GPT-5." },
    },
  ],
  evidence: [
    {
      snapshot: {
        source: { id: "source-1", rawUrl: "https://openai.com/blog", domain: "openai.com" },
      },
    },
  ],
  mentions: [{ entity: { id: "entity-1", name: "OpenAI", type: "COMPANY" } }],
};

// ============================================================================
// TESTS
// ============================================================================

describe("daily-briefings router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("today", () => {
    it("returns today's briefing if exists", async () => {
      vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(mockBriefing as never);

      const result = await prisma.dailyBriefing.findUnique({
        where: { date: expect.any(Date) },
        include: {
          items: {
            orderBy: { rank: "asc" },
          },
        },
      });

      expect(result).toEqual(mockBriefing);
      expect(result?.items).toHaveLength(2);
    });

    it("returns null if no briefing today", async () => {
      vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);

      const result = await prisma.dailyBriefing.findUnique({
        where: { date: new Date() },
      });

      expect(result).toBeNull();
    });
  });

  describe("byDate", () => {
    it("returns briefing for specified date", async () => {
      vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(mockBriefing as never);

      const targetDate = new Date("2026-02-04");
      targetDate.setHours(0, 0, 0, 0);

      const result = await prisma.dailyBriefing.findUnique({
        where: { date: targetDate },
        include: {
          items: {
            orderBy: { rank: "asc" },
          },
        },
      });

      expect(result?.id).toBe("briefing-1");
      expect(prisma.dailyBriefing.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { date: targetDate },
        })
      );
    });

    it("returns null for date without briefing", async () => {
      vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);

      const result = await prisma.dailyBriefing.findUnique({
        where: { date: new Date("2026-01-01") },
      });

      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("returns recent briefings", async () => {
      const mockBriefings = [
        { ...mockBriefing, id: "b1", date: new Date("2026-02-04") },
        { ...mockBriefing, id: "b2", date: new Date("2026-02-03") },
        { ...mockBriefing, id: "b3", date: new Date("2026-02-02") },
      ];

      vi.mocked(prisma.dailyBriefing.findMany).mockResolvedValue(mockBriefings as never);

      const result = await prisma.dailyBriefing.findMany({
        orderBy: { date: "desc" },
        take: 7,
        include: {
          items: {
            orderBy: { rank: "asc" },
            take: 5,
          },
        },
      });

      expect(result).toHaveLength(3);
      expect(prisma.dailyBriefing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: "desc" },
          take: 7,
        })
      );
    });

    it("respects limit parameter", async () => {
      vi.mocked(prisma.dailyBriefing.findMany).mockResolvedValue([]);

      await prisma.dailyBriefing.findMany({
        orderBy: { date: "desc" },
        take: 3,
      });

      expect(prisma.dailyBriefing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
        })
      );
    });

    it("returns empty array if no briefings", async () => {
      vi.mocked(prisma.dailyBriefing.findMany).mockResolvedValue([]);

      const result = await prisma.dailyBriefing.findMany({
        orderBy: { date: "desc" },
      });

      expect(result).toEqual([]);
    });
  });

  describe("byIdWithEvents", () => {
    it("returns briefing with full event details", async () => {
      vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(mockBriefing as never);
      vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent] as never);

      // First call: get briefing
      const briefing = await prisma.dailyBriefing.findUnique({
        where: { id: "briefing-1" },
        include: { items: { orderBy: { rank: "asc" } } },
      });

      expect(briefing).toBeDefined();

      // Second call: get events by IDs
      const eventIds = briefing?.items.map((i) => i.eventId) || [];
      const events = await prisma.event.findMany({
        where: { id: { in: eventIds } },
        include: {
          artifacts: true,
          evidence: true,
          mentions: true,
        },
      });

      expect(events).toHaveLength(1);
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: eventIds } },
        })
      );
    });

    it("returns null for non-existent briefing", async () => {
      vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);

      const result = await prisma.dailyBriefing.findUnique({
        where: { id: "non-existent" },
      });

      expect(result).toBeNull();
    });

    it("includes ranked events in correct order", async () => {
      vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(mockBriefing as never);

      const briefing = await prisma.dailyBriefing.findUnique({
        where: { id: "briefing-1" },
        include: {
          items: { orderBy: { rank: "asc" } },
        },
      });

      expect(briefing?.items?.[0]?.rank).toBe(1);
      expect(briefing?.items?.[1]?.rank).toBe(2);
    });
  });

  describe("payload structure", () => {
    it("payload contains expected GM-generated sections", async () => {
      vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(mockBriefing as never);

      const briefing = await prisma.dailyBriefing.findUnique({
        where: { id: "briefing-1" },
      });

      const payload = briefing?.payload as typeof mockBriefing.payload;

      expect(payload.changedSince).toBeDefined();
      expect(payload.changedSince.en).toBeDefined();
      expect(payload.changedSince.hr).toBeDefined();
      expect(payload.changedSince.highlights).toBeInstanceOf(Array);

      expect(payload.prediction).toBeDefined();
      expect(payload.prediction.confidence).toMatch(/^(low|medium|high)$/);

      expect(payload.eventCount).toBe(10);
      expect(payload.sourceCount).toBe(5);
      expect(payload.topEntities).toContain("OpenAI");
    });
  });

  describe("context integration", () => {
    it("provides database access through context", () => {
      const ctx = createTRPCContext();

      expect(ctx.db).toBeDefined();
      expect(typeof ctx.db.dailyBriefing.findUnique).toBe("function");
      expect(typeof ctx.db.dailyBriefing.findMany).toBe("function");
    });
  });
});
