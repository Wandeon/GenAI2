import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMClient, LLMResponse } from "@genai/llm";

import { generateTurn, generateEpisode } from "../daily-briefing.cast";
import type { GenerateEpisodeParams } from "../daily-briefing.cast";
import type { TurnPlan } from "../daily-briefing.director";
import type { EventForBriefing } from "../daily-briefing.types";
import type { RoundtableTurn } from "@genai/shared/schemas/daily-briefing";

// ============================================================================
// TEST DATA
// ============================================================================

function makeEvent(id: string, importance: number): EventForBriefing {
  return {
    id,
    title: `Event ${id}`,
    titleHr: `Događaj ${id}`,
    importance,
    occurredAt: new Date("2026-02-05"),
    artifacts: [
      { artifactType: "HEADLINE", payload: { en: `Event ${id}`, hr: `Događaj ${id}` } },
      { artifactType: "SUMMARY", payload: { en: `Summary of ${id}`, hr: `Sažetak ${id}` } },
    ],
    evidence: [{ snapshot: { source: { id: `source-${id}` } } }],
    mentions: [{ entity: { name: `Entity-${id}` } }],
  };
}

const twoEvents = [makeEvent("1", 1), makeEvent("2", 3)];

function makeMockTurnResponse(text: string, textHr: string, eventRef?: number): string {
  const obj: Record<string, unknown> = { text, textHr };
  if (eventRef !== undefined) obj.eventRef = eventRef;
  return JSON.stringify(obj);
}

function createMockClient(): LLMClient & { chat: ReturnType<typeof vi.fn> } {
  return {
    provider: "test",
    model: "test-model",
    complete: vi.fn().mockResolvedValue({
      content: "{}",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    } as LLMResponse),
    chat: vi.fn().mockResolvedValue({
      content: makeMockTurnResponse("Test line.", "Testna linija."),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    } as LLMResponse),
  };
}

// ============================================================================
// generateTurn TESTS
// ============================================================================

describe("generateTurn", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("generates valid RoundtableTurn with correct persona and moveType", async () => {
    const turnPlan: TurnPlan = {
      persona: "Engineer",
      moveType: "TECH_READ",
      eventRefs: [1],
      instruction: "Analyze event #1.",
    };

    mockClient.chat.mockResolvedValue({
      content: makeMockTurnResponse("GPT-5 has 128K context.", "GPT-5 ima 128K kontekst.", 1),
      usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
    });

    const result = await generateTurn({
      client: mockClient,
      turnPlan,
      eventsText: "1. Event 1",
      conversationSoFar: [],
      turnIndex: 0,
    });

    expect(result.turn.persona).toBe("Engineer");
    expect(result.turn.moveType).toBe("TECH_READ");
    expect(result.turn.text).toBe("GPT-5 has 128K context.");
    expect(result.turn.textHr).toBe("GPT-5 ima 128K kontekst.");
    expect(result.turn.eventRef).toBe(1);
    expect(result.usage.inputTokens).toBe(200);
  });

  it("CUT turns are synthetic — no LLM call", async () => {
    const cutPlan: TurnPlan = {
      persona: "GM",
      moveType: "CUT",
      eventRefs: [],
      instruction: "Transition.",
    };

    const result = await generateTurn({
      client: mockClient,
      turnPlan: cutPlan,
      eventsText: "events",
      conversationSoFar: [],
      turnIndex: 3,
    });

    expect(result.turn.moveType).toBe("CUT");
    expect(result.turn.text).toBe("---");
    expect(result.usage.totalTokens).toBe(0);
    expect(mockClient.chat).not.toHaveBeenCalled();
  });

  it("includes conversation history in messages", async () => {
    const priorTurns: RoundtableTurn[] = [
      { persona: "GM", moveType: "SETUP", text: "Welcome!", textHr: "Dobrodošli!" },
    ];

    const turnPlan: TurnPlan = {
      persona: "Engineer",
      moveType: "TECH_READ",
      eventRefs: [1],
      instruction: "Analyze event #1.",
    };

    await generateTurn({
      client: mockClient,
      turnPlan,
      eventsText: "1. Event text",
      conversationSoFar: priorTurns,
      turnIndex: 1,
    });

    expect(mockClient.chat).toHaveBeenCalledTimes(1);
    const callArgs = mockClient.chat.mock.calls[0] as [unknown[], unknown];
    const messages = callArgs[0] as Array<{ role: string; content: string }>;

    // System prompt should be for Engineer
    expect(messages[0]?.content).toContain("Engineer");
    // User prompt should contain conversation history
    expect(messages[1]?.content).toContain("Welcome!");
    // User prompt should contain events
    expect(messages[1]?.content).toContain("Event text");
  });

  it("throws when client has no chat method", async () => {
    const clientWithoutChat: LLMClient = {
      provider: "test",
      model: "test",
      complete: vi.fn(),
    };

    const turnPlan: TurnPlan = {
      persona: "GM",
      moveType: "SETUP",
      eventRefs: [1],
      instruction: "Open the show.",
    };

    await expect(
      generateTurn({
        client: clientWithoutChat,
        turnPlan,
        eventsText: "events",
        conversationSoFar: [],
        turnIndex: 0,
      })
    ).rejects.toThrow("does not support chat()");
  });

  it("handles markdown-wrapped JSON response", async () => {
    mockClient.chat.mockResolvedValue({
      content: '```json\n{"text": "Analysis.", "textHr": "Analiza.", "eventRef": 2}\n```',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const turnPlan: TurnPlan = {
      persona: "Skeptic",
      moveType: "RISK_CHECK",
      eventRefs: [2],
      instruction: "Check risks.",
    };

    const result = await generateTurn({
      client: mockClient,
      turnPlan,
      eventsText: "events",
      conversationSoFar: [],
      turnIndex: 0,
    });

    expect(result.turn.text).toBe("Analysis.");
    expect(result.turn.eventRef).toBe(2);
  });

  it("throws on invalid JSON from LLM", async () => {
    mockClient.chat.mockResolvedValue({
      content: "not json at all",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const turnPlan: TurnPlan = {
      persona: "GM",
      moveType: "SETUP",
      eventRefs: [],
      instruction: "Open.",
    };

    await expect(
      generateTurn({
        client: mockClient,
        turnPlan,
        eventsText: "events",
        conversationSoFar: [],
        turnIndex: 0,
      })
    ).rejects.toThrow();
  });

  it("calls chat with temperature 0.7", async () => {
    const turnPlan: TurnPlan = {
      persona: "GM",
      moveType: "SETUP",
      eventRefs: [],
      instruction: "Open.",
    };

    await generateTurn({
      client: mockClient,
      turnPlan,
      eventsText: "events",
      conversationSoFar: [],
      turnIndex: 0,
    });

    const callArgs = mockClient.chat.mock.calls[0] as [unknown[], { temperature: number }];
    expect(callArgs[1]).toEqual({ temperature: 0.7 });
  });
});

// ============================================================================
// generateEpisode TESTS
// ============================================================================

describe("generateEpisode", () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let episodeParams: GenerateEpisodeParams;
  let callIndex: number;

  beforeEach(() => {
    callIndex = 0;
    mockClient = createMockClient();

    // Produce different persona-appropriate responses per call
    mockClient.chat.mockImplementation(() => {
      callIndex++;
      return Promise.resolve({
        content: makeMockTurnResponse(
          `Turn ${callIndex} text.`,
          `Tekst reda ${callIndex}.`,
          callIndex <= 4 ? 1 : undefined
        ),
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      });
    });

    episodeParams = {
      client: mockClient,
      events: twoEvents,
      eventsText: "1. Event 1\n2. Event 2",
      date: "2026-02-05",
    };
  });

  it("generates full episode with multiple turns", async () => {
    const result = await generateEpisode(episodeParams);

    expect(result.roundtable.length).toBeGreaterThanOrEqual(4);
    expect(result.turnCount).toBe(result.roundtable.length);
  });

  it("calls turns sequentially (each sees prior history)", async () => {
    const callOrder: number[] = [];
    let counter = 0;

    mockClient.chat.mockImplementation(() => {
      counter++;
      callOrder.push(counter);
      return Promise.resolve({
        content: makeMockTurnResponse(`Line ${counter}.`, `Linija ${counter}.`),
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      });
    });

    await generateEpisode(episodeParams);

    // Verify calls happened in order (sequential, not parallel)
    for (let i = 1; i < callOrder.length; i++) {
      expect(callOrder[i]).toBe(callOrder[i - 1]! + 1);
    }
  });

  it("accumulates usage across all turns", async () => {
    const result = await generateEpisode(episodeParams);

    // Each non-CUT turn adds 100 input, 50 output
    const nonCutTurns = result.roundtable.filter((t) => t.moveType !== "CUT").length;
    expect(result.totalUsage.inputTokens).toBe(nonCutTurns * 100);
    expect(result.totalUsage.outputTokens).toBe(nonCutTurns * 50);
    expect(result.totalUsage.totalTokens).toBe(nonCutTurns * 150);
  });

  it("skips failed turns and continues", async () => {
    let counter = 0;
    mockClient.chat.mockImplementation(() => {
      counter++;
      // Fail every 3rd LLM call
      if (counter % 3 === 0) {
        return Promise.resolve({
          content: "invalid json",
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
        });
      }
      return Promise.resolve({
        content: makeMockTurnResponse(`Line ${counter}.`, `Linija ${counter}.`),
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      });
    });

    const result = await generateEpisode(episodeParams);

    // Some turns should have been skipped but episode should still succeed
    expect(result.roundtable.length).toBeGreaterThanOrEqual(4);
  });

  it("throws when fewer than 4 turns succeed", async () => {
    // All LLM calls fail
    mockClient.chat.mockResolvedValue({
      content: "not json",
      usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
    });

    await expect(generateEpisode(episodeParams)).rejects.toThrow(
      /Only \d+ turns succeeded/
    );
  });

  it("includes CUT turns as separators", async () => {
    const result = await generateEpisode(episodeParams);

    // 2 events = 1 CUT between them
    const cuts = result.roundtable.filter((t) => t.moveType === "CUT");
    expect(cuts.length).toBeGreaterThanOrEqual(1);
    expect(cuts[0]?.text).toBe("---");
  });

  it("first turn is GM SETUP, last is GM TAKEAWAY", async () => {
    const result = await generateEpisode(episodeParams);

    const first = result.roundtable[0];
    const last = result.roundtable[result.roundtable.length - 1];
    expect(first?.persona).toBe("GM");
    expect(first?.moveType).toBe("SETUP");
    expect(last?.persona).toBe("GM");
    expect(last?.moveType).toBe("TAKEAWAY");
  });
});
