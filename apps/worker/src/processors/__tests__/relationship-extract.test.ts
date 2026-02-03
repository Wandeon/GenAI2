import { describe, it, expect, beforeEach, vi } from "vitest";
import { extractRelationships } from "../relationship-extract";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";

// ============================================================================
// RELATIONSHIP EXTRACT PROCESSOR TESTS
// ============================================================================
// Tests for Phase 2: Event Pipeline - Tasks 84 & 85
// Implements TDD - tests written before implementation

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    relationship: {
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

// Helper to create mock event with entities and evidence
function createMockEventWithEntities(overrides = {}) {
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
          fullText: "OpenAI has released GPT-5, their latest large language model.",
          publishedAt: new Date("2026-01-15T10:00:00Z"),
          source: {
            trustTier: "STANDARD",
          },
        },
      },
    ],
    mentions: [
      {
        id: "mention-1",
        entityId: "entity-openai",
        role: "SUBJECT",
        confidence: 0.95,
        entity: {
          id: "entity-openai",
          name: "OpenAI",
          type: "COMPANY",
        },
      },
      {
        id: "mention-2",
        entityId: "entity-gpt5",
        role: "OBJECT",
        confidence: 0.9,
        entity: {
          id: "entity-gpt5",
          name: "GPT-5",
          type: "MODEL",
        },
      },
    ],
    ...overrides,
  };
}

describe("relationship-extract processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractRelationships", () => {
    describe("relationship extraction", () => {
      it("extracts relationships between entities", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              { sourceEntity: "OpenAI", targetEntity: "GPT-5", type: "RELEASED", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockResolvedValue({
            id: "rel-1",
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
        const result = await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.relationshipsExtracted).toBe(1);
        expect(prisma.relationship.create).toHaveBeenCalledTimes(1);
      });

      it("creates Relationship records correctly", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              { sourceEntity: "OpenAI", targetEntity: "GPT-5", type: "RELEASED", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockResolvedValue({
            id: "rel-1",
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
        await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(prisma.relationship.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              sourceId: "entity-openai",
              targetId: "entity-gpt5",
              type: "RELEASED",
              eventId: mockEvent.id,
              modelConfidence: 0.95,
              occurredAt: mockEvent.occurredAt,
            }),
          })
        );
      });
    });

    describe("safety gate validation", () => {
      it("applies safety gate to relationships", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              { sourceEntity: "OpenAI", targetEntity: "GPT-5", type: "RELEASED", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockResolvedValue({
            id: "rel-1",
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
        await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - relationship should have status and statusReason from safety gate
        expect(prisma.relationship.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: expect.any(String),
              statusReason: expect.any(String),
            }),
          })
        );
      });

      it("handles APPROVED status for low-risk relationships", async () => {
        // Arrange - RELEASED is low-risk, should be APPROVED with any source
        const mockEvent = createMockEventWithEntities();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              { sourceEntity: "OpenAI", targetEntity: "GPT-5", type: "RELEASED", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        let capturedStatus = "";
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockImplementation(((args: {
            data: { status: string };
          }) => {
            capturedStatus = args.data.status;
            return Promise.resolve({ id: "rel-1" });
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
        await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - RELEASED is low-risk, should be APPROVED
        expect(capturedStatus).toBe("APPROVED");
      });

      it("handles QUARANTINED status for high-risk without authoritative source", async () => {
        // Arrange - ACQUIRED is high-risk, needs AUTHORITATIVE source or 2+ sources
        const mockEvent = createMockEventWithEntities({
          mentions: [
            {
              id: "mention-1",
              entityId: "entity-msft",
              role: "SUBJECT",
              confidence: 0.95,
              entity: {
                id: "entity-msft",
                name: "Microsoft",
                type: "COMPANY",
              },
            },
            {
              id: "mention-2",
              entityId: "entity-openai",
              role: "OBJECT",
              confidence: 0.9,
              entity: {
                id: "entity-openai",
                name: "OpenAI",
                type: "COMPANY",
              },
            },
          ],
          // Single non-authoritative source
          evidence: [
            {
              id: "ev-link-1",
              role: "PRIMARY",
              snapshot: {
                id: "snapshot-abc123",
                title: "Microsoft acquires OpenAI",
                fullText: "Microsoft has acquired OpenAI in a major deal.",
                publishedAt: new Date("2026-01-15T10:00:00Z"),
                source: {
                  trustTier: "LOW", // LOW trust tier, single source
                },
              },
            },
          ],
        });

        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              {
                sourceEntity: "Microsoft",
                targetEntity: "OpenAI",
                type: "ACQUIRED",
                confidence: 0.8,
              },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        let capturedStatus = "";
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockImplementation(((args: {
            data: { status: string };
          }) => {
            capturedStatus = args.data.status;
            return Promise.resolve({ id: "rel-1" });
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
        await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - ACQUIRED is high-risk with single LOW source, should be QUARANTINED
        expect(capturedStatus).toBe("QUARANTINED");
      });

      it("handles APPROVED status for high-risk with authoritative source", async () => {
        // Arrange - ACQUIRED is high-risk but AUTHORITATIVE source should approve
        const mockEvent = createMockEventWithEntities({
          mentions: [
            {
              id: "mention-1",
              entityId: "entity-msft",
              role: "SUBJECT",
              confidence: 0.95,
              entity: {
                id: "entity-msft",
                name: "Microsoft",
                type: "COMPANY",
              },
            },
            {
              id: "mention-2",
              entityId: "entity-openai",
              role: "OBJECT",
              confidence: 0.9,
              entity: {
                id: "entity-openai",
                name: "OpenAI",
                type: "COMPANY",
              },
            },
          ],
          evidence: [
            {
              id: "ev-link-1",
              role: "PRIMARY",
              snapshot: {
                id: "snapshot-abc123",
                title: "Microsoft acquires OpenAI",
                fullText: "Microsoft has acquired OpenAI in a major deal.",
                publishedAt: new Date("2026-01-15T10:00:00Z"),
                source: {
                  trustTier: "AUTHORITATIVE", // Official source
                },
              },
            },
          ],
        });

        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              {
                sourceEntity: "Microsoft",
                targetEntity: "OpenAI",
                type: "ACQUIRED",
                confidence: 0.95,
              },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        let capturedStatus = "";
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockImplementation(((args: {
            data: { status: string };
          }) => {
            capturedStatus = args.data.status;
            return Promise.resolve({ id: "rel-1" });
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
        await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - ACQUIRED with AUTHORITATIVE source should be APPROVED
        expect(capturedStatus).toBe("APPROVED");
      });
    });

    describe("entity count validation", () => {
      it("skips when fewer than 2 entities", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities({
          mentions: [
            {
              id: "mention-1",
              entityId: "entity-openai",
              role: "SUBJECT",
              confidence: 0.95,
              entity: {
                id: "entity-openai",
                name: "OpenAI",
                type: "COMPANY",
              },
            },
            // Only 1 entity - not enough for relationships
          ],
        });
        mockEvent.mentions.pop(); // Remove second entity

        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ relationships: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toContain("Fewer than 2 entities");
        expect(result.relationshipsExtracted).toBe(0);
        // LLM should not be called
        expect(prisma.relationship.create).not.toHaveBeenCalled();
      });

      it("skips when no entities mentioned", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities({
          mentions: [], // No entities
        });

        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ relationships: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.relationshipsExtracted).toBe(0);
      });
    });

    describe("LLM cost tracking", () => {
      it("logs LLM run for cost tracking", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              { sourceEntity: "OpenAI", targetEntity: "GPT-5", type: "RELEASED", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockResolvedValue({
            id: "rel-1",
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
        const result = await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

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
              processorName: "relationship-extract",
              eventId: mockEvent.id,
            }),
          })
        );
      });
    });

    describe("artifact creation", () => {
      it("creates RELATIONSHIP_EXTRACT artifact", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              { sourceEntity: "OpenAI", targetEntity: "GPT-5", type: "RELEASED", confidence: 0.95 },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockResolvedValue({
            id: "rel-1",
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
        await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(prisma.eventArtifact.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              artifactType: "RELATIONSHIP_EXTRACT",
              payload: expect.objectContaining({
                relationships: expect.any(Array),
              }),
            }),
          })
        );
      });
    });

    describe("error handling", () => {
      it("handles event not found error", async () => {
        // Arrange
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ relationships: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          return callback(prisma);
        });

        // Act
        const result = await extractRelationships({ eventId: "non-existent" }, mockLLMClient);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
      });

      it("skips events not in ENRICHED status", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities({ status: "RAW" });
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({ relationships: [] }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          return callback(prisma);
        });

        // Act
        const result = await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
        expect(result.skipReason).toContain("not in ENRICHED status");
      });

      it("handles empty relationship list", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [],
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
        const result = await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.relationshipsExtracted).toBe(0);
        expect(prisma.relationship.create).not.toHaveBeenCalled();
        // Artifact should still be created even with empty relationships
        expect(prisma.eventArtifact.create).toHaveBeenCalled();
      });

      it("skips relationships with unknown entities", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities();
        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              // This entity doesn't exist in mentions
              {
                sourceEntity: "UnknownCompany",
                targetEntity: "GPT-5",
                type: "RELEASED",
                confidence: 0.9,
              },
            ],
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
        const result = await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert - should succeed but not create the relationship
        expect(result.success).toBe(true);
        expect(result.relationshipsExtracted).toBe(0);
        expect(prisma.relationship.create).not.toHaveBeenCalled();
      });
    });

    describe("multiple relationships", () => {
      it("handles multiple relationships in one event", async () => {
        // Arrange
        const mockEvent = createMockEventWithEntities({
          mentions: [
            {
              id: "mention-1",
              entityId: "entity-openai",
              role: "SUBJECT",
              confidence: 0.95,
              entity: {
                id: "entity-openai",
                name: "OpenAI",
                type: "COMPANY",
              },
            },
            {
              id: "mention-2",
              entityId: "entity-gpt5",
              role: "OBJECT",
              confidence: 0.9,
              entity: {
                id: "entity-gpt5",
                name: "GPT-5",
                type: "MODEL",
              },
            },
            {
              id: "mention-3",
              entityId: "entity-msft",
              role: "MENTIONED",
              confidence: 0.8,
              entity: {
                id: "entity-msft",
                name: "Microsoft",
                type: "COMPANY",
              },
            },
          ],
        });

        const mockLLMClient = createMockLLMClient({
          content: JSON.stringify({
            relationships: [
              { sourceEntity: "OpenAI", targetEntity: "GPT-5", type: "RELEASED", confidence: 0.95 },
              {
                sourceEntity: "Microsoft",
                targetEntity: "OpenAI",
                type: "PARTNERED",
                confidence: 0.8,
              },
            ],
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.relationship.create).mockResolvedValue({
            id: "rel-1",
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
        const result = await extractRelationships({ eventId: mockEvent.id }, mockLLMClient);

        // Assert
        expect(result.success).toBe(true);
        expect(result.relationshipsExtracted).toBe(2);
        expect(prisma.relationship.create).toHaveBeenCalledTimes(2);
      });
    });
  });
});
