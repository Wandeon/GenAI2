import { describe, it, expect, beforeEach, vi } from "vitest";
import { createEvidenceSnapshot } from "../evidence-snapshot";
import { prisma } from "@genai/db";

// ============================================================================
// EVIDENCE SNAPSHOT PROCESSOR TESTS
// ============================================================================
// Tests for Phase 2: Event Pipeline - Task 1
// Implements TDD - tests written before implementation

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    evidenceSource: { upsert: vi.fn() },
    evidenceSnapshot: { create: vi.fn() },
  },
}));

describe("evidence-snapshot processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEvidenceSnapshot", () => {
    describe("EvidenceSource creation", () => {
      it("creates new EvidenceSource for new URL", async () => {
        // Arrange
        const mockSource = {
          id: "source-123",
          rawUrl: "https://openai.com/blog/gpt-5?utm_source=twitter",
          canonicalUrl: "https://openai.com/blog/gpt-5",
          domain: "openai.com",
          trustTier: "AUTHORITATIVE",
        };

        const mockSnapshot = {
          id: "snapshot-456",
          sourceId: "source-123",
          contentHash: "abc123",
        };

        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue(mockSource as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue(mockSnapshot as never);

        // Act
        const result = await createEvidenceSnapshot({
          url: "https://openai.com/blog/gpt-5?utm_source=twitter",
          content: "GPT-5 is here!",
          sourceType: "NEWSAPI",
          sourceId: "newsapi-12345",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { canonicalUrl: "https://openai.com/blog/gpt-5" },
            create: expect.objectContaining({
              rawUrl: "https://openai.com/blog/gpt-5?utm_source=twitter",
              canonicalUrl: "https://openai.com/blog/gpt-5",
              domain: "openai.com",
            }),
            update: {},
          })
        );
        expect(result.sourceId).toBe("source-123");
      });

      it("canonicalizes URL by removing tracking parameters", async () => {
        // Arrange
        const mockSource = {
          id: "source-123",
          canonicalUrl: "https://anthropic.com/news/claude-4",
          domain: "anthropic.com",
          trustTier: "AUTHORITATIVE",
        };

        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue(mockSource as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-123",
          contentHash: "hash",
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://anthropic.com/news/claude-4?utm_campaign=launch&ref=hn&fbclid=abc",
          content: "Claude 4 announcement",
          sourceType: "HN",
          sourceId: "hn-item-123",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { canonicalUrl: "https://anthropic.com/news/claude-4" },
          })
        );
      });
    });

    describe("content hash generation", () => {
      it("generates SHA-256 hash of content for deduplication", async () => {
        // Arrange
        const content = "This is the article content";
        // SHA-256 of "This is the article content"
        const expectedHash = "a1b2c3d4e5f6"; // Placeholder - actual hash will be computed

        const mockSource = {
          id: "source-123",
          canonicalUrl: "https://techcrunch.com/article",
          domain: "techcrunch.com",
          trustTier: "STANDARD",
        };

        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue(mockSource as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-123",
          contentHash: expectedHash,
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://techcrunch.com/article",
          content,
          sourceType: "NEWSAPI",
          sourceId: "newsapi-456",
        });

        // Assert
        expect(prisma.evidenceSnapshot.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              contentHash: expect.stringMatching(/^[a-f0-9]{64}$/), // SHA-256 is 64 hex chars
              fullText: content,
            }),
          })
        );
      });

      it("produces different hashes for different content", async () => {
        // This test verifies the hash function produces unique outputs
        const content1 = "Content version 1";
        const content2 = "Content version 2";

        const mockSource = {
          id: "source-123",
          canonicalUrl: "https://example.com/article",
          domain: "example.com",
          trustTier: "STANDARD",
        };

        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue(mockSource as never);

        const capturedHashes: string[] = [];
        vi.mocked(prisma.evidenceSnapshot.create).mockImplementation(async (args) => {
          const hash = (args as { data: { contentHash: string } }).data.contentHash;
          capturedHashes.push(hash);
          return { id: "snap-" + capturedHashes.length, sourceId: "source-123", contentHash: hash } as never;
        });

        // Act
        await createEvidenceSnapshot({
          url: "https://example.com/article",
          content: content1,
          sourceType: "NEWSAPI",
          sourceId: "id-1",
        });

        await createEvidenceSnapshot({
          url: "https://example.com/article",
          content: content2,
          sourceType: "NEWSAPI",
          sourceId: "id-2",
        });

        // Assert
        expect(capturedHashes).toHaveLength(2);
        expect(capturedHashes[0]).not.toBe(capturedHashes[1]);
      });
    });

    describe("trust tier determination", () => {
      it("assigns AUTHORITATIVE tier for openai.com", async () => {
        // Arrange
        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue({
          id: "source-1",
          canonicalUrl: "https://openai.com/blog/announcement",
          domain: "openai.com",
          trustTier: "AUTHORITATIVE",
        } as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-1",
          contentHash: "hash",
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://openai.com/blog/announcement",
          content: "OpenAI announcement",
          sourceType: "NEWSAPI",
          sourceId: "id-1",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              trustTier: "AUTHORITATIVE",
            }),
          })
        );
      });

      it("assigns AUTHORITATIVE tier for anthropic.com", async () => {
        // Arrange
        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue({
          id: "source-1",
          canonicalUrl: "https://anthropic.com/news",
          domain: "anthropic.com",
          trustTier: "AUTHORITATIVE",
        } as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-1",
          contentHash: "hash",
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://anthropic.com/news",
          content: "Anthropic news",
          sourceType: "NEWSAPI",
          sourceId: "id-1",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              trustTier: "AUTHORITATIVE",
            }),
          })
        );
      });

      it("assigns AUTHORITATIVE tier for deepmind.google", async () => {
        // Arrange
        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue({
          id: "source-1",
          canonicalUrl: "https://deepmind.google/research",
          domain: "deepmind.google",
          trustTier: "AUTHORITATIVE",
        } as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-1",
          contentHash: "hash",
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://deepmind.google/research",
          content: "DeepMind research",
          sourceType: "NEWSAPI",
          sourceId: "id-1",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              trustTier: "AUTHORITATIVE",
            }),
          })
        );
      });

      it("assigns STANDARD tier for general news sites", async () => {
        // Arrange
        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue({
          id: "source-1",
          canonicalUrl: "https://techcrunch.com/ai-news",
          domain: "techcrunch.com",
          trustTier: "STANDARD",
        } as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-1",
          contentHash: "hash",
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://techcrunch.com/ai-news",
          content: "AI news article",
          sourceType: "NEWSAPI",
          sourceId: "id-1",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              trustTier: "STANDARD",
            }),
          })
        );
      });

      it("assigns LOW tier for reddit.com", async () => {
        // Arrange
        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue({
          id: "source-1",
          canonicalUrl: "https://reddit.com/r/MachineLearning",
          domain: "reddit.com",
          trustTier: "LOW",
        } as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-1",
          contentHash: "hash",
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://reddit.com/r/MachineLearning",
          content: "Reddit discussion",
          sourceType: "REDDIT",
          sourceId: "reddit-post-123",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              trustTier: "LOW",
            }),
          })
        );
      });

      it("assigns LOW tier for twitter.com", async () => {
        // Arrange
        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue({
          id: "source-1",
          canonicalUrl: "https://twitter.com/user/status/123",
          domain: "twitter.com",
          trustTier: "LOW",
        } as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-1",
          contentHash: "hash",
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://twitter.com/user/status/123",
          content: "Tweet content",
          sourceType: "NEWSAPI",
          sourceId: "tweet-123",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              trustTier: "LOW",
            }),
          })
        );
      });

      it("assigns LOW tier for x.com (Twitter rebrand)", async () => {
        // Arrange
        vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue({
          id: "source-1",
          canonicalUrl: "https://x.com/user/status/123",
          domain: "x.com",
          trustTier: "LOW",
        } as never);
        vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({
          id: "snap-1",
          sourceId: "source-1",
          contentHash: "hash",
        } as never);

        // Act
        await createEvidenceSnapshot({
          url: "https://x.com/user/status/123",
          content: "X post content",
          sourceType: "NEWSAPI",
          sourceId: "x-post-123",
        });

        // Assert
        expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              trustTier: "LOW",
            }),
          })
        );
      });
    });
  });
});
