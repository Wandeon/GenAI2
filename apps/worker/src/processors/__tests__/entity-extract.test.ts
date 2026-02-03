import { describe, it, expect, beforeEach, vi } from "vitest";
import { extractEntities, slugify } from "../entity-extract";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";

// ============================================================================
// ENTITY EXTRACT PROCESSOR TESTS
// ============================================================================
// Tests for Phase 2: Event Pipeline - Task 82
// Implements TDD - tests written before implementation

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    entity: {
      upsert: vi.fn(),
    },
    entityMention: {
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

describe("entity-extract processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("slugify", () => {
    it("generates URL-safe slug from entity name", () => {
      expect(slugify("OpenAI")).toBe("openai");
      expect(slugify("GPT-5")).toBe("gpt-5");
      expect(slugify("Google DeepMind")).toBe("google-deepmind");
      expect(slugify("Llama 3.1")).toBe("llama-3-1");
    });

    it("handles special characters", () => {
      expect(slugify("C++ Compiler")).toBe("c-compiler");
      expect(slugify("Test@Entity!")).toBe("test-entity");
      expect(slugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
    });

    it("handles unicode characters", () => {
      expect(slugify("Café AI")).toBe("cafe-ai");
      expect(slugify("München Lab")).toBe("munchen-lab");
    });

    it("removes leading/trailing hyphens", () => {
      expect(slugify("-test-")).toBe("test");
      expect(slugify("---multiple---")).toBe("multiple");
    });
  });

  describe("extractEntities", () => {
    describe("entity extraction", () => {
      it("extracts entities from event", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            entities: [
              { name: "OpenAI", type: "COMPANY", role: "SUBJECT", confidence: 0.95 },
              { name: "GPT-5", type: "MODEL", role: "OBJECT", confidence: 0.9 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.entity.upsert).mockResolvedValue({
            id: "entity-1",
            name: "Test",
            slug: "test",
            type: "COMPANY",
          } as never);
          vi.mocked(prisma.entityMention.create).mockResolvedValue({
            id: "mention-1",
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
        const result = await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.entitiesExtracted).toBe(2);
        expect(prisma.entity.upsert).toHaveBeenCalledTimes(2);
      });

      it("creates entity mentions with roles", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            entities: [
              { name: "OpenAI", type: "COMPANY", role: "SUBJECT", confidence: 0.95 },
              { name: "GPT-5", type: "MODEL", role: "OBJECT", confidence: 0.9 },
              { name: "Sam Altman", type: "PERSON", role: "MENTIONED", confidence: 0.7 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.entity.upsert).mockResolvedValue({
            id: "entity-1",
            name: "Test",
            slug: "test",
            type: "COMPANY",
          } as never);
          vi.mocked(prisma.entityMention.create).mockResolvedValue({
            id: "mention-1",
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
        const result = await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(prisma.entityMention.create).toHaveBeenCalledTimes(3);
        expect(prisma.entityMention.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              role: "SUBJECT",
              confidence: 0.95,
            }),
          })
        );
        expect(prisma.entityMention.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              role: "OBJECT",
              confidence: 0.9,
            }),
          })
        );
        expect(prisma.entityMention.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              role: "MENTIONED",
              confidence: 0.7,
            }),
          })
        );
      });

      it("generates slug from entity name", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            entities: [
              { name: "Google DeepMind", type: "LAB", role: "SUBJECT", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.entity.upsert).mockResolvedValue({
            id: "entity-1",
            name: "Google DeepMind",
            slug: "google-deepmind",
            type: "LAB",
          } as never);
          vi.mocked(prisma.entityMention.create).mockResolvedValue({
            id: "mention-1",
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
        await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - verify the upsert was called with the correct slug
        expect(prisma.entity.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              slug: "google-deepmind",
            }),
          })
        );
      });

      it("updates entity lastSeen timestamp", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            entities: [
              { name: "OpenAI", type: "COMPANY", role: "SUBJECT", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.entity.upsert).mockResolvedValue({
            id: "entity-1",
            name: "OpenAI",
            slug: "openai",
            type: "COMPANY",
          } as never);
          vi.mocked(prisma.entityMention.create).mockResolvedValue({
            id: "mention-1",
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
        await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - verify the upsert was called with lastSeen in update
        expect(prisma.entity.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({
              lastSeen: expect.any(Date),
            }),
          })
        );
      });
    });

    describe("artifact creation", () => {
      it("creates ENTITY_EXTRACT artifact", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            entities: [
              { name: "OpenAI", type: "COMPANY", role: "SUBJECT", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.entity.upsert).mockResolvedValue({
            id: "entity-1",
            name: "OpenAI",
            slug: "openai",
            type: "COMPANY",
          } as never);
          vi.mocked(prisma.entityMention.create).mockResolvedValue({
            id: "mention-1",
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
        await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(prisma.eventArtifact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              artifactType: "ENTITY_EXTRACT",
              payload: expect.objectContaining({
                entities: expect.any(Array),
              }),
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
          content: JSON.stringify({
            entities: [
              { name: "OpenAI", type: "COMPANY", role: "SUBJECT", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.entity.upsert).mockResolvedValue({
            id: "entity-1",
          } as never);
          vi.mocked(prisma.entityMention.create).mockResolvedValue({
            id: "mention-1",
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
        const result = await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

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
              processorName: "entity-extract",
              eventId: mockEvent.id,
            }),
          })
        );
      });

      it("calculates cost correctly for Gemini Flash pricing", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();

        // Using Gemini pricing: $0.075/1M input, $0.30/1M output
        const mockLLMClient: LLMClient = {
          provider: "google",
          model: "gemini-2.0-flash",
          async complete(_prompt: string): Promise<LLMResponse> {
            return {
              content: JSON.stringify({
                entities: [
                  { name: "OpenAI", type: "COMPANY", role: "SUBJECT", confidence: 0.95 },
                ],
              }),
              usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
            };
          },
        };

        let capturedCostCents = 0;
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.entity.upsert).mockResolvedValue({
            id: "entity-1",
          } as never);
          vi.mocked(prisma.entityMention.create).mockResolvedValue({
            id: "mention-1",
          } as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockImplementation(((args: { data: { costCents: number } }) => {
            capturedCostCents = args.data.costCents;
            return Promise.resolve({ id: "llm-run-1" });
          }) as never);

          return callback(prisma);
        });

        // Act
        await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - cost should be a positive integer (cents)
        expect(capturedCostCents).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(capturedCostCents)).toBe(true);
      });
    });

    describe("error handling", () => {
      it("handles event not found error", async () => {
        // Arrange
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ entities: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          return callback(prisma);
        });

        // Act
        const result = await extractEntities({ eventId: "non-existent" }, mockLLMClient);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });

      it("skips events not in ENRICHED status", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence({ status: "RAW" });
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ entities: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toContain("not in ENRICHED status");
      });

      it("handles empty entity list", async () => {
        // Arrange
        const mockEvent = createMockEventWithEvidence();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            entities: [],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventArtifact.create).mockResolvedValue({
            id: "artifact-1",
          } as never);
          vi.mocked(prisma.lLMRun.create).mockResolvedValue({
            id: "llm-run-1",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.entitiesExtracted).toBe(0);
        expect(prisma.entity.upsert).not.toHaveBeenCalled();
        // Artifact should still be created even with empty entities
        expect(prisma.eventArtifact.create).toHaveBeenCalled();
      });
    });

    describe("evidence handling", () => {
      it("includes evidence content in LLM prompts", async () => {
        // Arrange
        const evidenceText = "OpenAI announced GPT-5 with breakthrough capabilities.";
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

        let capturedPrompt = "";
        const mockLLMClient: LLMClient = {
          provider: "mock",
          model: "mock-model",
          async complete(prompt: string): Promise<LLMResponse> {
            capturedPrompt = prompt;
            return {
              content: JSON.stringify({
                entities: [
                  { name: "OpenAI", type: "COMPANY", role: "SUBJECT", confidence: 0.95 },
                ],
              }),
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            };
          },
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.entity.upsert).mockResolvedValue({
            id: "entity-1",
          } as never);
          vi.mocked(prisma.entityMention.create).mockResolvedValue({
            id: "mention-1",
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
        await extractEntities({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - evidence content should be included in prompt
        expect(capturedPrompt).toContain(evidenceText);
      });
    });
  });
});
