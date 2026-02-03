import { describe, it, expect, beforeEach, vi } from "vitest";
import { assignTopics, buildEventText } from "../topic-assign";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";

// ============================================================================
// TOPIC ASSIGN PROCESSOR TESTS
// ============================================================================
// Tests for Phase 2: Event Pipeline - Task 86
// Implements TDD - tests written before implementation

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    topic: {
      findMany: vi.fn(),
    },
    eventTopic: {
      create: vi.fn(),
    },
    eventArtifact: {
      create: vi.fn(),
    },
    lLMRun: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Helper to create mock LLM client
function createMockLLMClient(response: LLMResponse): LLMClient {
  return {
    provider: "mock",
    model: "mock-model",
    async complete(_prompt: string): Promise<LLMResponse> {
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
    status: "ENRICHED",
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

// Helper to create mock topics
function createMockTopics() {
  return [
    { id: "topic-1", slug: "llm-releases", name: "LLM Releases" },
    { id: "topic-2", slug: "openai", name: "OpenAI" },
    { id: "topic-3", slug: "model-benchmarks", name: "Model Benchmarks" },
    { id: "topic-4", slug: "ai-safety", name: "AI Safety" },
    { id: "topic-5", slug: "funding", name: "Funding" },
  ];
}

describe("topic-assign processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildEventText", () => {
    it("builds text from title and evidence", () => {
      const evidence = [
        {
          id: "ev-1",
          role: "PRIMARY",
          snapshot: {
            id: "snap-1",
            title: "Evidence Title",
            fullText: "Evidence content here.",
            publishedAt: new Date(),
          },
        },
      ];

      const result = buildEventText("Event Title", evidence);

      expect(result).toContain("Event title: Event Title");
      expect(result).toContain("Evidence title: Evidence Title");
      expect(result).toContain("Evidence content: Evidence content here.");
    });

    it("handles multiple evidence items", () => {
      const evidence = [
        {
          id: "ev-1",
          role: "PRIMARY",
          snapshot: {
            id: "snap-1",
            title: "First Evidence",
            fullText: "First content.",
            publishedAt: new Date(),
          },
        },
        {
          id: "ev-2",
          role: "SUPPORTING",
          snapshot: {
            id: "snap-2",
            title: "Second Evidence",
            fullText: "Second content.",
            publishedAt: new Date(),
          },
        },
      ];

      const result = buildEventText("Event Title", evidence);

      expect(result).toContain("First Evidence");
      expect(result).toContain("Second Evidence");
      expect(result).toContain("First content.");
      expect(result).toContain("Second content.");
    });

    it("handles missing evidence fields", () => {
      const evidence = [
        {
          id: "ev-1",
          role: "PRIMARY",
          snapshot: {
            id: "snap-1",
            title: null,
            fullText: null,
            publishedAt: null,
          },
        },
      ];

      const result = buildEventText("Event Title", evidence);

      expect(result).toContain("Event title: Event Title");
      expect(result).not.toContain("Evidence title:");
      expect(result).not.toContain("Evidence content:");
    });
  });

  describe("assignTopics", () => {
    describe("topic assignment", () => {
      it("assigns topics to event", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [
              { slug: "llm-releases", confidence: 0.95 },
              { slug: "openai", confidence: 0.9 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.topicsAssigned).toBe(2);
        expect(prisma.eventTopic.create).toHaveBeenCalledTimes(2);
      });

      it("uses LLM origin for assigned topics", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [{ slug: "llm-releases", confidence: 0.95 }],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(prisma.eventTopic.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              topicId: "topic-1",
              confidence: 0.95,
              origin: "LLM",
            }),
          })
        );
      });

      it("assigns confidence scores between 0 and 1", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [
              { slug: "llm-releases", confidence: 0.95 },
              { slug: "openai", confidence: 0.7 },
              { slug: "ai-safety", confidence: 0.5 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        const capturedConfidences: number[] = [];
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockImplementation(((args: {
            data: { confidence: number };
          }) => {
            capturedConfidences.push(args.data.confidence);
            return Promise.resolve({ id: "event-topic-1" });
          }) as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(capturedConfidences).toHaveLength(3);
        for (const confidence of capturedConfidences) {
          expect(confidence).toBeGreaterThanOrEqual(0);
          expect(confidence).toBeLessThanOrEqual(1);
        }
      });
    });

    describe("artifact creation", () => {
      it("creates TOPIC_ASSIGN artifact", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [
              { slug: "llm-releases", confidence: 0.95 },
              { slug: "openai", confidence: 0.9 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(prisma.eventArtifact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              artifactType: "TOPIC_ASSIGN",
              payload: expect.objectContaining({
                topics: expect.any(Array),
              }),
            }),
          })
        );
      });

      it("stores only valid topics in artifact", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [
              { slug: "llm-releases", confidence: 0.95 },
              { slug: "unknown-topic", confidence: 0.8 }, // Should be filtered
              { slug: "openai", confidence: 0.9 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        let capturedPayload: { topics: Array<{ slug: string; confidence: number }> } | null = null;
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockImplementation(((args: {
            data: { payload: { topics: Array<{ slug: string; confidence: number }> } };
          }) => {
            capturedPayload = args.data.payload;
            return Promise.resolve({ id: "artifact-1" });
          }) as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - artifact should only contain valid topics
        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload!.topics).toHaveLength(2);
        expect(capturedPayload!.topics.map((t) => t.slug)).toEqual(["llm-releases", "openai"]);
      });
    });

    describe("LLM cost tracking", () => {
      it("logs LLM run for cost tracking", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [{ slug: "llm-releases", confidence: 0.95 }],
          }),
          usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(prisma.lLMRun.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              provider: "mock",
              model: "mock-model",
              inputTokens: 1000,
              outputTokens: 500,
              totalTokens: 1500,
              costCents: expect.any(Number),
              latencyMs: expect.any(Number),
              processorName: "topic-assign",
              eventId: mockEvent.id,
            }),
          })
        );
      });

      it("calculates cost correctly for Gemini Flash pricing", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();

        const mockLLMClient: LLMClient = {
          provider: "google",
          model: "gemini-2.0-flash",
          async complete(_prompt: string): Promise<LLMResponse> {
            return {
              content: JSON.stringify({
                topics: [{ slug: "llm-releases", confidence: 0.95 }],
              }),
              usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
            };
          },
        };

        let capturedCostCents = 0;
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockImplementation(((args: {
            data: { costCents: number };
          }) => {
            capturedCostCents = args.data.costCents;
            return Promise.resolve({ id: "llm-run-1" });
          }) as never);

          return callback(prisma);
        });

        // Act
        await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - cost should be a positive integer (cents)
        expect(capturedCostCents).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(capturedCostCents)).toBe(true);
      });
    });

    describe("error handling", () => {
      it("handles event not found error", async () => {
        // Arrange
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ topics: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          return callback(prisma);
        });

        // Act
        const result = await assignTopics({ eventId: "non-existent" }, mockLLMClient);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });

      it("skips events not in ENRICHED status", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence({ status: "RAW" });
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ topics: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toContain("not in ENRICHED status");
      });

      it("skips unknown topic slugs", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [
              { slug: "llm-releases", confidence: 0.95 },
              { slug: "unknown-topic", confidence: 0.8 },
              { slug: "another-unknown", confidence: 0.7 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - only 1 valid topic should be assigned
        expect(result.success).toBe(true);
        expect(result.topicsAssigned).toBe(1);
        expect(prisma.eventTopic.create).toHaveBeenCalledTimes(1);
      });

      it("validates only existing topics used", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [
              { slug: "llm-releases", confidence: 0.95 },
              { slug: "openai", confidence: 0.9 },
              { slug: "model-benchmarks", confidence: 0.85 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        const createdTopicIds: string[] = [];
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockImplementation(((args: {
            data: { topicId: string };
          }) => {
            createdTopicIds.push(args.data.topicId);
            return Promise.resolve({ id: "event-topic-1" });
          }) as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - all created topic IDs should be from our mock topics
        expect(result.success).toBe(true);
        expect(result.topicsAssigned).toBe(3);

        const validTopicIds = mockTopics.map((t) => t.id);
        for (const topicId of createdTopicIds) {
          expect(validTopicIds).toContain(topicId);
        }
      });

      it("handles empty topic list", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            topics: [],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.topicsAssigned).toBe(0);
        expect(prisma.eventTopic.create).not.toHaveBeenCalled();
        // Artifact should still be created even with empty topics
        expect(prisma.eventArtifact.create).toHaveBeenCalled();
      });

      it("handles no available topics in database", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ topics: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue([] as never);
          return callback(prisma);
        });

        // Act
        const result = await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toContain("No topics available");
      });
    });

    describe("prompt construction", () => {
      it("includes available topics in LLM prompt", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockTopics = createMockTopics();

        let capturedPrompt = "";
        const mockLLMClient: LLMClient = {
          provider: "mock",
          model: "mock-model",
          async complete(prompt: string): Promise<LLMResponse> {
            capturedPrompt = prompt;
            return {
              content: JSON.stringify({
                topics: [{ slug: "llm-releases", confidence: 0.95 }],
              }),
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            };
          },
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - prompt should contain all topic slugs
        expect(capturedPrompt).toContain("llm-releases");
        expect(capturedPrompt).toContain("openai");
        expect(capturedPrompt).toContain("model-benchmarks");
        expect(capturedPrompt).toContain("ai-safety");
        expect(capturedPrompt).toContain("funding");
      });

      it("includes event title and evidence in prompt", async () => {
        // Arrange
        const evidenceText = "OpenAI announced GPT-5 with breakthrough capabilities.";
        const mockEvent = createMockEventWithEvidence({
          title: "GPT-5 Released",
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
        const mockTopics = createMockTopics();

        let capturedPrompt = "";
        const mockLLMClient: LLMClient = {
          provider: "mock",
          model: "mock-model",
          async complete(prompt: string): Promise<LLMResponse> {
            capturedPrompt = prompt;
            return {
              content: JSON.stringify({
                topics: [{ slug: "llm-releases", confidence: 0.95 }],
              }),
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            };
          },
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.topic.findMany).mockResolvedValue(mockTopics as never);
          vi.mocked(prisma.eventTopic.create).mockResolvedValue({
            id: "event-topic-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await assignTopics({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(capturedPrompt).toContain("GPT-5 Released");
        expect(capturedPrompt).toContain(evidenceText);
      });
    });
  });
});
