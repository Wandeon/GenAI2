import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import {
  generateFingerprint,
  createEvent,
  type EventCreateInput,
} from "../event-create";
import { prisma } from "@genai/db";

// ============================================================================
// EVENT CREATE PROCESSOR TESTS
// ============================================================================
// Tests for Phase 2: Event Pipeline - Task 2
// Implements TDD - tests written before implementation

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    eventEvidence: {
      create: vi.fn(),
    },
    eventStatusChange: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("event-create processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateFingerprint", () => {
    it("generates consistent fingerprint for same inputs", () => {
      // Arrange
      const title = "OpenAI releases GPT-5";
      const occurredAt = new Date("2026-01-15T00:00:00Z");
      const sourceType = "NEWSAPI";

      // Act
      const fingerprint1 = generateFingerprint(title, occurredAt, sourceType);
      const fingerprint2 = generateFingerprint(title, occurredAt, sourceType);

      // Assert
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(32);
      expect(fingerprint1).toMatch(/^[a-f0-9]{32}$/);
    });

    it("generates different fingerprint for different titles", () => {
      // Arrange
      const occurredAt = new Date("2026-01-15T00:00:00Z");
      const sourceType = "NEWSAPI";

      // Act
      const fingerprint1 = generateFingerprint("OpenAI releases GPT-5", occurredAt, sourceType);
      const fingerprint2 = generateFingerprint("Anthropic releases Claude 4", occurredAt, sourceType);

      // Assert
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it("generates different fingerprint for different dates", () => {
      // Arrange
      const title = "OpenAI releases GPT-5";
      const sourceType = "NEWSAPI";

      // Act
      const fingerprint1 = generateFingerprint(title, new Date("2026-01-15T00:00:00Z"), sourceType);
      const fingerprint2 = generateFingerprint(title, new Date("2026-01-16T00:00:00Z"), sourceType);

      // Assert
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it("generates different fingerprint for different source types", () => {
      // Arrange
      const title = "OpenAI releases GPT-5";
      const occurredAt = new Date("2026-01-15T00:00:00Z");

      // Act
      const fingerprint1 = generateFingerprint(title, occurredAt, "NEWSAPI");
      const fingerprint2 = generateFingerprint(title, occurredAt, "HN");

      // Assert
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it("normalizes title case and whitespace", () => {
      // Arrange
      const occurredAt = new Date("2026-01-15T00:00:00Z");
      const sourceType = "NEWSAPI";

      // Act - same title with different case and whitespace
      const fingerprint1 = generateFingerprint("OpenAI releases GPT-5", occurredAt, sourceType);
      const fingerprint2 = generateFingerprint("  OPENAI  RELEASES  GPT-5  ", occurredAt, sourceType);
      const fingerprint3 = generateFingerprint("openai releases gpt-5", occurredAt, sourceType);

      // Assert - all should produce same fingerprint
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toBe(fingerprint3);
    });

    it("produces expected hash format", () => {
      // Arrange
      const title = "Test Event";
      const occurredAt = new Date("2026-01-15T00:00:00Z");
      const sourceType = "HN";

      // Expected: SHA-256 of "HN:2026-01-15:test event"
      const normalizedTitle = "test event";
      const dateStr = "2026-01-15";
      const input = `${sourceType}:${dateStr}:${normalizedTitle}`;
      const expectedHash = crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);

      // Act
      const fingerprint = generateFingerprint(title, occurredAt, sourceType);

      // Assert
      expect(fingerprint).toBe(expectedHash);
    });
  });

  describe("createEvent", () => {
    const baseInput: EventCreateInput = {
      title: "OpenAI releases GPT-5",
      occurredAt: new Date("2026-01-15T12:00:00Z"),
      sourceType: "NEWSAPI",
      sourceId: "newsapi-12345",
      snapshotId: "snapshot-abc123",
    };

    describe("when fingerprint not found (new event)", () => {
      it("creates new event with correct data", async () => {
        // Arrange
        const mockEvent = {
          id: "event-new-123",
          fingerprint: "abcd1234567890abcd1234567890ab",
          title: baseInput.title,
          occurredAt: baseInput.occurredAt,
          status: "RAW",
          sourceType: baseInput.sourceType,
          sourceId: baseInput.sourceId,
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          // Simulate no existing event
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          vi.mocked(prisma.event.create).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-1",
            eventId: mockEvent.id,
            snapshotId: baseInput.snapshotId,
            role: "PRIMARY",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
            eventId: mockEvent.id,
            fromStatus: null,
            toStatus: "RAW",
            reason: "Initial creation",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await createEvent(baseInput);

        // Assert
        expect(result.created).toBe(true);
        expect(result.eventId).toBe("event-new-123");
        expect(result.fingerprint).toMatch(/^[a-f0-9]{32}$/);
      });

      it("creates EventEvidence link with PRIMARY role", async () => {
        // Arrange
        const mockEvent = {
          id: "event-new-123",
          fingerprint: "abcd1234567890abcd1234567890ab",
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          vi.mocked(prisma.event.create).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-1",
            eventId: mockEvent.id,
            snapshotId: baseInput.snapshotId,
            role: "PRIMARY",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await createEvent(baseInput);

        // Assert
        expect(prisma.eventEvidence.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              snapshotId: baseInput.snapshotId,
              role: "PRIMARY",
            }),
          })
        );
      });

      it("creates initial EventStatusChange to RAW", async () => {
        // Arrange
        const mockEvent = {
          id: "event-new-123",
          fingerprint: "abcd1234567890abcd1234567890ab",
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          vi.mocked(prisma.event.create).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
            eventId: mockEvent.id,
            fromStatus: null,
            toStatus: "RAW",
            reason: "Initial creation",
          } as never);

          return callback(prisma);
        });

        // Act
        await createEvent(baseInput);

        // Assert
        expect(prisma.eventStatusChange.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: mockEvent.id,
              fromStatus: null,
              toStatus: "RAW",
              reason: "Initial creation",
            }),
          })
        );
      });

      it("uses optional titleHr when provided", async () => {
        // Arrange
        const inputWithHr: EventCreateInput = {
          ...baseInput,
          titleHr: "OpenAI objavio GPT-5",
        };

        const mockEvent = {
          id: "event-new-123",
          fingerprint: "abcd1234567890abcd1234567890ab",
          titleHr: "OpenAI objavio GPT-5",
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          vi.mocked(prisma.event.create).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await createEvent(inputWithHr);

        // Assert
        expect(prisma.event.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              titleHr: "OpenAI objavio GPT-5",
            }),
          })
        );
      });

      it("uses optional impactLevel when provided", async () => {
        // Arrange
        const inputWithImpact: EventCreateInput = {
          ...baseInput,
          impactLevel: "BREAKING",
        };

        const mockEvent = {
          id: "event-new-123",
          fingerprint: "abcd1234567890abcd1234567890ab",
          impactLevel: "BREAKING",
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          vi.mocked(prisma.event.create).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await createEvent(inputWithImpact);

        // Assert
        expect(prisma.event.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              impactLevel: "BREAKING",
            }),
          })
        );
      });
    });

    describe("when fingerprint exists (duplicate)", () => {
      it("skips event creation and adds SUPPORTING evidence", async () => {
        // Arrange
        const existingEvent = {
          id: "event-existing-456",
          fingerprint: "abcd1234567890abcd1234567890ab",
          title: baseInput.title,
          occurredAt: baseInput.occurredAt,
          status: "RAW",
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          // Simulate existing event found
          vi.mocked(prisma.event.findUnique).mockResolvedValue(existingEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-2",
            eventId: existingEvent.id,
            snapshotId: baseInput.snapshotId,
            role: "SUPPORTING",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await createEvent(baseInput);

        // Assert
        expect(result.created).toBe(false);
        expect(result.eventId).toBe("event-existing-456");
        expect(prisma.event.create).not.toHaveBeenCalled();
        expect(prisma.eventStatusChange.create).not.toHaveBeenCalled();
      });

      it("links evidence with SUPPORTING role for duplicate", async () => {
        // Arrange
        const existingEvent = {
          id: "event-existing-456",
          fingerprint: "abcd1234567890abcd1234567890ab",
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(existingEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-2",
            eventId: existingEvent.id,
            snapshotId: baseInput.snapshotId,
            role: "SUPPORTING",
          } as never);

          return callback(prisma);
        });

        // Act
        await createEvent(baseInput);

        // Assert
        expect(prisma.eventEvidence.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              eventId: existingEvent.id,
              snapshotId: baseInput.snapshotId,
              role: "SUPPORTING",
            }),
          })
        );
      });

      it("returns the existing event fingerprint", async () => {
        // Arrange
        const existingEvent = {
          id: "event-existing-456",
          fingerprint: "existingfingerprint123456789ab",
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(existingEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-2",
          } as never);

          return callback(prisma);
        });

        // Act
        const result = await createEvent(baseInput);

        // Assert
        expect(result.fingerprint).toBe("existingfingerprint123456789ab");
      });
    });

    describe("transaction behavior", () => {
      it("executes all operations within a transaction", async () => {
        // Arrange
        const mockEvent = {
          id: "event-new-123",
          fingerprint: "abcd1234567890abcd1234567890ab",
        };

        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
          vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
          vi.mocked(prisma.event.create).mockResolvedValue(mockEvent as never);
          vi.mocked(prisma.eventEvidence.create).mockResolvedValue({
            id: "evidence-link-1",
          } as never);
          vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({
            id: "status-change-1",
          } as never);

          return callback(prisma);
        });

        // Act
        await createEvent(baseInput);

        // Assert
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      });
    });
  });
});
