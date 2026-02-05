import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMClient, LLMResponse } from "@genai/llm";
import {
  generateDailyBriefing,
  buildEventsText,
  countUniqueSources,
  extractTopEntities,
  generateBriefingPrompt,
  generateLegacyBriefingPrompt,
  parseJsonResponse,
} from "../daily-briefing";
import type { EventForBriefing } from "../daily-briefing.types";
import { prisma } from "@genai/db";

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    dailyBriefing: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
    },
    lLMRun: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockEvent: EventForBriefing = {
  id: "event-1",
  title: "OpenAI Launches GPT-5",
  titleHr: "OpenAI lansira GPT-5",
  importance: 0.9,
  occurredAt: new Date("2026-02-04"),
  artifacts: [
    {
      artifactType: "HEADLINE",
      payload: { en: "OpenAI Launches GPT-5", hr: "OpenAI lansira GPT-5" },
    },
    {
      artifactType: "SUMMARY",
      payload: { en: "OpenAI released GPT-5 today.", hr: "OpenAI je objavio GPT-5." },
    },
    {
      artifactType: "WHAT_HAPPENED",
      payload: { en: "OpenAI released GPT-5 with 10x context window." },
    },
    {
      artifactType: "WHY_MATTERS",
      payload: { text: "Largest context window in production LLM." },
    },
  ],
  evidence: [
    { snapshot: { source: { id: "source-1" } } },
    { snapshot: { source: { id: "source-2" } } },
  ],
  mentions: [
    { entity: { name: "OpenAI" } },
    { entity: { name: "GPT-5" } },
  ],
};

const mockEvent2: EventForBriefing = {
  id: "event-2",
  title: "Google Announces Gemini 3",
  titleHr: "Google najavljuje Gemini 3",
  importance: 0.85,
  occurredAt: new Date("2026-02-04"),
  artifacts: [
    {
      artifactType: "HEADLINE",
      payload: { en: "Google Announces Gemini 3", hr: "Google najavljuje Gemini 3" },
    },
  ],
  evidence: [
    { snapshot: { source: { id: "source-1" } } },
  ],
  mentions: [
    { entity: { name: "Google" } },
    { entity: { name: "Gemini 3" } },
    { entity: { name: "OpenAI" } },
  ],
};

const validRoundtablePayload = {
  roundtable: [
    { persona: "GM" as const, moveType: "SETUP" as const, text: "Two major model launches today.", textHr: "Dva velika lansiranja modela danas." },
    { persona: "Engineer" as const, moveType: "TECH_READ" as const, text: "GPT-5 ships with 10x context window at 128K tokens.", textHr: "GPT-5 dolazi s 10x kontekstnim prozorom od 128K tokena.", eventRef: 1 },
    { persona: "Skeptic" as const, moveType: "RISK_CHECK" as const, text: "No independent benchmarks yet. OpenAI's own numbers are marketing.", textHr: "Nema neovisnih mjerila. OpenAI-jevi brojevi su marketing.", eventRef: 1 },
    { persona: "Engineer" as const, moveType: "TECH_READ" as const, text: "Gemini 3 claims native multimodal from day one.", textHr: "Gemini 3 tvrdi nativnu multimodalnost od prvog dana.", eventRef: 2 },
    { persona: "Skeptic" as const, moveType: "CROSS_EXAM" as const, text: "Same claim Google made with Gemini 1. Where are the API docs?", textHr: "Istu tvrdnju Google je dao s Gemini 1. Gdje su API dokumenti?", eventRef: 2 },
    { persona: "GM" as const, moveType: "TAKEAWAY" as const, text: "Both launches need independent validation. Watch for benchmark drops this week.", textHr: "Oba lansiranja trebaju neovisnu provjeru. Pratite rezultate mjerila ovaj tjedan." },
  ],
  prediction: {
    en: "Watch for benchmark comparisons",
    hr: "Pratite usporedbe na testovima",
    confidence: "medium" as const,
    caveats: ["Early benchmarks may be incomplete"],
  },
  action: {
    en: "Try GPT-5 API",
    hr: "Isprobajte GPT-5 API",
  },
  gmNote: {
    en: "Exciting competition!",
    hr: "Uzbudljiva konkurencija!",
  },
  eventCount: 2,
  sourceCount: 2,
  topEntities: ["OpenAI", "Google"],
};

const legacyBriefingPayload = {
  changedSince: {
    en: "Major AI announcements today",
    hr: "Velike AI najave danas",
    highlights: ["GPT-5 launched", "Gemini 3 announced"],
  },
  prediction: {
    en: "Watch for benchmark comparisons",
    hr: "Pratite usporedbe na testovima",
    confidence: "medium" as const,
    caveats: ["Early benchmarks may be incomplete"],
  },
  action: {
    en: "Try GPT-5 API",
    hr: "Isprobajte GPT-5 API",
  },
  gmNote: {
    en: "Exciting times!",
    hr: "Uzbudljiva vremena!",
  },
  eventCount: 2,
  sourceCount: 2,
  topEntities: ["OpenAI", "Google"],
};

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe("daily-briefing utilities", () => {
  describe("buildEventsText", () => {
    it("builds formatted text from events", () => {
      const result = buildEventsText([mockEvent]);
      expect(result).toContain("1. OpenAI Launches GPT-5");
      expect(result).toContain("OpenAI released GPT-5 today.");
      expect(result).toContain("Entities: OpenAI, GPT-5");
    });

    it("includes WHAT_HAPPENED when present", () => {
      const result = buildEventsText([mockEvent]);
      expect(result).toContain("What happened: OpenAI released GPT-5 with 10x context window.");
    });

    it("includes WHY_MATTERS when present", () => {
      const result = buildEventsText([mockEvent]);
      expect(result).toContain("Why it matters: Largest context window in production LLM.");
    });

    it("handles events without WHAT_HAPPENED or WHY_MATTERS gracefully", () => {
      const result = buildEventsText([mockEvent2]);
      expect(result).not.toContain("What happened:");
      expect(result).not.toContain("Why it matters:");
      expect(result).toContain("1. Google Announces Gemini 3");
    });

    it("handles events without artifacts", () => {
      const event = {
        ...mockEvent,
        artifacts: [],
      };
      const result = buildEventsText([event]);
      expect(result).toContain("1. OpenAI Launches GPT-5");
      expect(result).toContain("No summary");
    });

    it("handles events without entities", () => {
      const event = {
        ...mockEvent,
        mentions: [],
      };
      const result = buildEventsText([event]);
      expect(result).toContain("Entities: None");
    });
  });

  describe("countUniqueSources", () => {
    it("counts unique sources across events", () => {
      const count = countUniqueSources([mockEvent, mockEvent2]);
      expect(count).toBe(2); // source-1, source-2
    });

    it("returns 0 for no events", () => {
      const count = countUniqueSources([]);
      expect(count).toBe(0);
    });
  });

  describe("extractTopEntities", () => {
    it("extracts top entities by frequency", () => {
      const entities = extractTopEntities([mockEvent, mockEvent2], 3);
      expect(entities).toContain("OpenAI"); // appears in both
      expect(entities.length).toBeLessThanOrEqual(3);
    });

    it("respects limit parameter", () => {
      const entities = extractTopEntities([mockEvent, mockEvent2], 1);
      expect(entities.length).toBe(1);
    });

    it("returns empty array for no events", () => {
      const entities = extractTopEntities([]);
      expect(entities).toEqual([]);
    });
  });

  describe("generateBriefingPrompt", () => {
    it("includes date in prompt", () => {
      const prompt = generateBriefingPrompt("events text", "2026-02-04");
      expect(prompt).toContain("2026-02-04");
    });

    it("includes events text", () => {
      const prompt = generateBriefingPrompt("Test events", "2026-02-04");
      expect(prompt).toContain("Test events");
    });

    it("includes persona definitions", () => {
      const prompt = generateBriefingPrompt("events", "2026-02-04");
      expect(prompt).toContain("GM (Host)");
      expect(prompt).toContain("Engineer");
      expect(prompt).toContain("Skeptic");
    });

    it("includes move type definitions", () => {
      const prompt = generateBriefingPrompt("events", "2026-02-04");
      expect(prompt).toContain("SETUP");
      expect(prompt).toContain("TECH_READ");
      expect(prompt).toContain("RISK_CHECK");
      expect(prompt).toContain("CROSS_EXAM");
      expect(prompt).toContain("EVIDENCE_CALL");
      expect(prompt).toContain("TAKEAWAY");
    });

    it("includes roundtable in output format", () => {
      const prompt = generateBriefingPrompt("events", "2026-02-04");
      expect(prompt).toContain("roundtable");
    });
  });

  describe("generateLegacyBriefingPrompt", () => {
    it("includes GM identity", () => {
      const prompt = generateLegacyBriefingPrompt("events", "2026-02-04");
      expect(prompt).toContain("You are GM");
      expect(prompt).toContain("Croatian audiences");
    });

    it("includes changedSince in output format", () => {
      const prompt = generateLegacyBriefingPrompt("events", "2026-02-04");
      expect(prompt).toContain("changedSince");
      expect(prompt).toContain("prediction");
    });
  });

  describe("parseJsonResponse", () => {
    it("parses plain JSON", () => {
      const result = parseJsonResponse('{"key": "value"}');
      expect(result).toEqual({ key: "value" });
    });

    it("handles markdown code blocks", () => {
      const result = parseJsonResponse('```json\n{"key": "value"}\n```');
      expect(result).toEqual({ key: "value" });
    });

    it("handles code blocks without json marker", () => {
      const result = parseJsonResponse('```\n{"key": "value"}\n```');
      expect(result).toEqual({ key: "value" });
    });

    it("throws on invalid JSON", () => {
      expect(() => parseJsonResponse("invalid")).toThrow();
    });
  });
});

// ============================================================================
// MAIN PROCESSOR TESTS
// ============================================================================

describe("generateDailyBriefing", () => {
  let mockLLMClient: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLLMClient = {
      provider: "google",
      model: "gemini-2.0-flash",
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify(validRoundtablePayload),
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
      } as LLMResponse),
    };
  });

  it("returns existing briefing if already generated", async () => {
    vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue({
      id: "existing-briefing",
      date: new Date("2026-02-04"),
    } as never);

    const result = await generateDailyBriefing(
      { date: "2026-02-04" },
      mockLLMClient
    );

    expect(result.success).toBe(true);
    expect(result.briefingId).toBe("existing-briefing");
    expect(result.eventCount).toBe(0);
    expect(mockLLMClient.complete).not.toHaveBeenCalled();
  });

  it("returns success with no briefing when no events", async () => {
    vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);

    const result = await generateDailyBriefing(
      { date: "2026-02-04" },
      mockLLMClient
    );

    expect(result.success).toBe(true);
    expect(result.eventCount).toBe(0);
    expect(result.briefingId).toBeUndefined();
    expect(mockLLMClient.complete).not.toHaveBeenCalled();
  });

  it("handles LLM failure gracefully", async () => {
    vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent] as never);
    mockLLMClient.complete = vi.fn().mockRejectedValue(new Error("LLM Error"));

    const result = await generateDailyBriefing(
      { date: "2026-02-04" },
      mockLLMClient
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("LLM call failed");
    expect(result.eventCount).toBe(1);
  });

  it("falls back to legacy when roundtable parse fails", async () => {
    vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent] as never);

    // First call returns invalid roundtable, second returns legacy
    let callCount = 0;
    mockLLMClient.complete = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          content: JSON.stringify({ ...legacyBriefingPayload }),
          usage: { inputTokens: 500, outputTokens: 250, totalTokens: 750 },
        });
      }
      return Promise.resolve({
        content: JSON.stringify(legacyBriefingPayload),
        usage: { inputTokens: 500, outputTokens: 250, totalTokens: 750 },
      });
    });

    // Mock transaction
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const txMock = {
        lLMRun: { create: vi.fn() },
        dailyBriefing: {
          create: vi.fn().mockResolvedValue({
            id: "fallback-briefing-id",
            date: new Date("2026-02-04"),
          }),
        },
      };
      return (callback as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock);
    });

    const result = await generateDailyBriefing(
      { date: "2026-02-04" },
      mockLLMClient
    );

    expect(result.success).toBe(true);
    expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
  });

  it("generates briefing successfully with roundtable", async () => {
    vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent, mockEvent2] as never);

    // Mock transaction to return briefing
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const txMock = {
        lLMRun: { create: vi.fn() },
        dailyBriefing: {
          create: vi.fn().mockResolvedValue({
            id: "new-briefing-id",
            date: new Date("2026-02-04"),
          }),
        },
      };
      return (callback as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock);
    });

    const result = await generateDailyBriefing(
      { date: "2026-02-04" },
      mockLLMClient
    );

    expect(result.success).toBe(true);
    expect(result.briefingId).toBe("new-briefing-id");
    expect(result.eventCount).toBe(2);
    expect(mockLLMClient.complete).toHaveBeenCalledTimes(1);
  });

  it("creates LLM run record for cost tracking", async () => {
    vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent] as never);

    const llmRunCreate = vi.fn();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const txMock = {
        lLMRun: { create: llmRunCreate },
        dailyBriefing: {
          create: vi.fn().mockResolvedValue({ id: "briefing-id" }),
        },
      };
      return (callback as unknown as (tx: typeof txMock) => Promise<unknown>)(txMock);
    });

    await generateDailyBriefing({ date: "2026-02-04" }, mockLLMClient);

    expect(llmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "google",
          model: "gemini-2.0-flash",
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number),
        }),
      })
    );
  });

  it("handles both roundtable and legacy parse failures", async () => {
    vi.mocked(prisma.dailyBriefing.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent] as never);
    mockLLMClient.complete = vi.fn().mockResolvedValue({
      content: "invalid json",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const result = await generateDailyBriefing(
      { date: "2026-02-04" },
      mockLLMClient
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Parse error");
    expect(mockLLMClient.complete).toHaveBeenCalledTimes(2);
  });
});
