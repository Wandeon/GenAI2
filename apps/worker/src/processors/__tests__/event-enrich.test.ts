import { describe, it, expect, beforeEach, vi } from "vitest";
import { enrichEvent } from "../event-enrich";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";

// ============================================================================
// EVENT ENRICH PROCESSOR TESTS
// ============================================================================
// Tests for Phase 2: Event Pipeline - Task 3
// Implements TDD - tests written before implementation

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    eventArtifact: {
      create: vi.fn(),
    },
    eventStatusChange: {
      create: vi.fn(),
    },
    lLMRun: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Helper to create mock LLM client
function createMockLLMClient(responses: Record<string, LLMResponse>): LLMClient {
  let callIndex = 0;
  const responseKeys = Object.keys(responses);

  return {
    provider: "mock",
    model: "mock-model",
    async complete(prompt: string): Promise<LLMResponse> {
      // Match based on artifact type markers in prompt
      for (const key of responseKeys) {
        if (prompt.includes(key)) {
          const response = responses[key];
          if (response) return response;
        }
      }
      // Default: return based on call order
      if (responseKeys.length === 0) {
        throw new Error("No responses configured");
      }
      const keyIndex = callIndex % responseKeys.length;
      const key = responseKeys[keyIndex];
      callIndex++;
      if (key === undefined) {
        throw new Error("No response key found");
      }
      const response = responses[key];
      if (!response) {
        throw new Error(`No response found for key: ${key}`);
      }
      return response;
    },
  };
}

// Helper to create mock event with evidence
function createMockEventWithEvidence(overrides = {}) {
  return {
    id: "event-123",
    title: "OpenAI releases GPT-5",
    titleHr: null,
    status: "RAW",
    occurredAt: new Date("2026-01-15T12:00:00Z"),
    sourceType: "NEWSAPI",
    sourceId: "newsapi-12345",
    evidence: [
      {
        id: "ev-link-1",
        role: "PRIMARY",
        snapshot: {
          id: "snapshot-abc123",
          title: "OpenAI releases GPT-5",
          fullText: "OpenAI has announced the release of GPT-5, their latest large language model.",
          publishedAt: new Date("2026-01-15T10:00:00Z"),
        },
      },
    ],
    ...overrides,
  };
}

describe("event-enrich processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enrichEvent", () => {
    describe("artifact generation", () => {
      it("generates HEADLINE artifact with bilingual content", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          HEADLINE: {
            content: JSON.stringify({
              en: "OpenAI Launches GPT-5",
              hr: "OpenAI objavio GPT-5",
            }),
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
          SUMMARY: {
            content: JSON.stringify({
              en: "OpenAI has released GPT-5.",
              hr: "OpenAI je objavio GPT-5.",
              bulletPoints: ["New model", "Better performance"],
            }),
            usage: { inputTokens: 150, outputTokens: 100, totalTokens: 250 },
          },
          GM_TAKE: {
            content: JSON.stringify({
              take: "This is significant.",
              takeHr: "Ovo je značajno.",
              confidence: "high",
              caveats: [],
            }),
            usage: { inputTokens: 200, outputTokens: 150, totalTokens: 350 },
          },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
            eventId: mockEvent.id,
            artifactType: "HEADLINE",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);
          vi.mocked(prisma.event.update).mockResolvedValue({
            ...mockEvent,
            status: "ENRICHED",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.artifacts).toContain("HEADLINE");
        expect(prisma.eventArtifact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              artifactType: "HEADLINE",
              payload: expect.objectContaining({
                en: expect.any(String),
                hr: expect.any(String),
              }),
            }),
          })
        );
      });

      it("generates SUMMARY artifact with bullet points", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          HEADLINE: {
            content: JSON.stringify({ en: "Test", hr: "Test" }),
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
          SUMMARY: {
            content: JSON.stringify({
              en: "OpenAI has released GPT-5, their latest model.",
              hr: "OpenAI je objavio GPT-5, svoj najnoviji model.",
              bulletPoints: ["New architecture", "Better reasoning", "Faster inference"],
            }),
            usage: { inputTokens: 150, outputTokens: 100, totalTokens: 250 },
          },
          GM_TAKE: {
            content: JSON.stringify({
              take: "Analysis here.",
              takeHr: "Analiza ovdje.",
              confidence: "medium",
            }),
            usage: { inputTokens: 200, outputTokens: 150, totalTokens: 350 },
          },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);
          vi.mocked(prisma.event.update).mockResolvedValue({
            ...mockEvent,
            status: "ENRICHED",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.artifacts).toContain("SUMMARY");
        expect(prisma.eventArtifact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              artifactType: "SUMMARY",
              payload: expect.objectContaining({
                bulletPoints: expect.any(Array),
              }),
            }),
          })
        );
      });

      it("generates GM_TAKE artifact with confidence level", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          HEADLINE: {
            content: JSON.stringify({ en: "Test", hr: "Test" }),
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
          SUMMARY: {
            content: JSON.stringify({
              en: "Summary",
              hr: "Sazjetak",
              bulletPoints: [],
            }),
            usage: { inputTokens: 150, outputTokens: 100, totalTokens: 250 },
          },
          GM_TAKE: {
            content: JSON.stringify({
              take: "This represents a major milestone in AI development.",
              takeHr: "Ovo predstavlja veliku prekretnicu u razvoju AI-ja.",
              confidence: "high",
              caveats: ["Limited independent verification", "Performance claims unverified"],
            }),
            usage: { inputTokens: 200, outputTokens: 150, totalTokens: 350 },
          },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);
          vi.mocked(prisma.event.update).mockResolvedValue({
            ...mockEvent,
            status: "ENRICHED",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.artifacts).toContain("GM_TAKE");
        expect(prisma.eventArtifact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              artifactType: "GM_TAKE",
              payload: expect.objectContaining({
                confidence: expect.stringMatching(/^(low|medium|high)$/),
              }),
            }),
          })
        );
      });
    });

    describe("status transition", () => {
      it("transitions event status from RAW to ENRICHED", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          HEADLINE: {
            content: JSON.stringify({ en: "Test", hr: "Test" }),
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
          SUMMARY: {
            content: JSON.stringify({ en: "S", hr: "S", bulletPoints: [] }),
            usage: { inputTokens: 150, outputTokens: 100, totalTokens: 250 },
          },
          GM_TAKE: {
            content: JSON.stringify({ take: "T", takeHr: "T", confidence: "medium" }),
            usage: { inputTokens: 200, outputTokens: 150, totalTokens: 350 },
          },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);
          vi.mocked(prisma.event.update).mockResolvedValue({
            ...mockEvent,
            status: "ENRICHED",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(prisma.event.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: mockEvent.id },
            data: { status: "ENRICHED" },
          })
        );
        expect(prisma.eventStatusChange.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              fromStatus: "RAW",
              toStatus: "ENRICHED",
              reason: expect.stringContaining("enrichment"),
            }),
          })
        );
      });
    });

    describe("LLM cost tracking", () => {
      it("logs LLM run for cost tracking", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          HEADLINE: {
            content: JSON.stringify({ en: "Test", hr: "Test" }),
            usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
          },
          SUMMARY: {
            content: JSON.stringify({ en: "S", hr: "S", bulletPoints: [] }),
            usage: { inputTokens: 1500, outputTokens: 800, totalTokens: 2300 },
          },
          GM_TAKE: {
            content: JSON.stringify({ take: "T", takeHr: "T", confidence: "medium" }),
            usage: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 },
          },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);
          vi.mocked(prisma.event.update).mockResolvedValue({
            ...mockEvent,
            status: "ENRICHED",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.totalLLMRuns).toBe(3); // One for each artifact type

        // Verify LLM runs were logged with cost tracking
        expect(prisma.lLMRun.create).toHaveBeenCalledTimes(3);
        expect(prisma.lLMRun.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              provider: "mock",
              model: "mock-model",
              inputTokens: expect.any(Number),
              outputTokens: expect.any(Number),
              totalTokens: expect.any(Number),
              costCents: expect.any(Number),
              latencyMs: expect.any(Number),
              processorName: "event-enrich",
              eventId: mockEvent.id,
            }),
          })
        );
      });

      it("calculates cost correctly for Gemini Flash pricing", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();

        // Using Gemini pricing: $0.075/1M input, $0.30/1M output
        // For 1000 input tokens: (1000/1_000_000) * 0.075 = $0.000075
        // For 500 output tokens: (500/1_000_000) * 0.30 = $0.00015
        // Total: $0.000225 = 0.0225 cents, rounds up to 1 cent minimum
        let callCount = 0;
        const mockLLMClient: LLMClient = {
          provider: "google",
          model: "gemini-2.0-flash",
          async complete(prompt: string): Promise<LLMResponse> {
            callCount++;
            // Return appropriate response based on artifact type in prompt
            if (prompt.includes("HEADLINE") || callCount === 1) {
              return {
                content: JSON.stringify({ en: "Test", hr: "Test" }),
                usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
              };
            } else if (prompt.includes("SUMMARY") || callCount === 2) {
              return {
                content: JSON.stringify({ en: "Summary", hr: "Sazetak", bulletPoints: ["Point 1"] }),
                usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
              };
            } else {
              return {
                content: JSON.stringify({ take: "Take", takeHr: "Uzmi", confidence: "medium" }),
                usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
              };
            }
          },
        };

        const capturedCostCents: number[] = [];

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockImplementation(((args: { data: { costCents: number } }) => {
            capturedCostCents.push(args.data.costCents);
            return Promise.resolve({ id: "llm-run-1" });
          }) as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);
          vi.mocked(prisma.event.update).mockResolvedValue({
            ...mockEvent,
            status: "ENRICHED",
          } as never);

          return callback(prisma);
        });

        // Act
        await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - each call should have cost calculated
        expect(capturedCostCents.length).toBe(3);
        // Cost should be a positive integer (cents)
        capturedCostCents.forEach((cost) => {
          expect(cost).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(cost)).toBe(true);
        });
      });
    });

    describe("skip conditions", () => {
      it("skips events not in RAW status", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence({ status: "ENRICHED" });
        const mockLLMClient = createMockLLMClient({
          HEADLINE: {
            content: JSON.stringify({ en: "Test", hr: "Test" }),
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toContain("not in RAW status");
        expect(prisma.eventArtifact.create).not.toHaveBeenCalled();
        expect(prisma.event.update).not.toHaveBeenCalled();
      });

      it("skips events with VERIFIED status", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence({ status: "VERIFIED" });
        const mockLLMClient = createMockLLMClient({});

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
      });

      it("skips events with PUBLISHED status", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence({ status: "PUBLISHED" });
        const mockLLMClient = createMockLLMClient({});

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
      });

      it("returns error for non-existent event", async () => {
        // Arrange
        const mockLLMClient = createMockLLMClient({});

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          return callback(prisma);
        });

        // Act
        const result = await enrichEvent({ eventId: "non-existent" }, mockLLMClient);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });
    });

    describe("evidence handling", () => {
      it("includes evidence content in LLM prompts", async () => {
        // Arrange
        const evidenceText = "OpenAI has announced GPT-5 with breakthrough capabilities.";
        const mockEvent = createMockEventWithEvidence({
          evidence: [
            {
              id: "ev-link-1",
              role: "PRIMARY",
              snapshot: {
                id: "snapshot-abc123",
                title: "GPT-5 Announcement",
                fullText: evidenceText,
                publishedAt: new Date("2026-01-15T10:00:00Z"),
              },
            },
          ],
        });

        let capturedPrompts: string[] = [];
        const mockLLMClient: LLMClient = {
          provider: "mock",
          model: "mock-model",
          async complete(prompt: string): Promise<LLMResponse> {
            capturedPrompts.push(prompt);
            return {
              content: JSON.stringify({ en: "Test", hr: "Test", bulletPoints: [], take: "T", takeHr: "T", confidence: "medium" }),
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            };
          },
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);
          vi.mocked(prisma.event.update).mockResolvedValue({
            ...mockEvent,
            status: "ENRICHED",
          } as never);

          return callback(prisma);
        });

        // Act
        await enrichEvent({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - evidence content should be included in prompts
        expect(capturedPrompts.some((p) => p.includes(evidenceText))).toBe(true);
      });
    });
  });
});
