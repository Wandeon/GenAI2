/**
 * Backfill Script for GenAI Observatory
 *
 * This script converts existing source data (HN, GitHub, arXiv entries)
 * into the new unified Event model with proper evidence chains.
 *
 * Usage: pnpm backfill
 *
 * Each source type backfill function:
 * 1. Queries existing entries from source table
 * 2. Creates EvidenceSource + EvidenceSnapshot for each URL
 * 3. Generates fingerprint for deduplication
 * 4. Creates Event with status RAW
 * 5. Links via EventEvidence
 */

import crypto from "crypto";
import { prisma } from "./index";
import {
  SourceType,
  EventStatus,
  TrustTier,
  EvidenceRole,
  type EvidenceSnapshot,
  type Event,
} from "@prisma/client";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Batch size for processing (used when actual implementation is done)
// const BATCH_SIZE = 100;

// Log progress every N entries
const LOG_INTERVAL = 50;

// Unused variable to avoid lint error - will be used in actual implementation
void LOG_INTERVAL;

interface BackfillStats {
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}

function createStats(): BackfillStats {
  return { processed: 0, created: 0, skipped: 0, errors: 0 };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a fingerprint for event deduplication.
 *
 * The fingerprint is a SHA-256 hash of:
 * - Source type (HN, GITHUB, ARXIV, etc.)
 * - Date (YYYY-MM-DD format)
 * - Normalized title (lowercase, trimmed)
 *
 * This allows detecting duplicate events across sources.
 *
 * @param title - The event title
 * @param date - The event date
 * @param sourceType - The source type enum value
 * @returns A 32-character hex string fingerprint
 */
export function generateFingerprint(
  title: string,
  date: Date,
  sourceType: SourceType
): string {
  const normalized = title.toLowerCase().trim();
  const dateStr = date.toISOString().split("T")[0];
  return crypto
    .createHash("sha256")
    .update(`${sourceType}:${dateStr}:${normalized}`)
    .digest("hex")
    .substring(0, 32);
}

/**
 * Generate a content hash for EvidenceSnapshot.
 *
 * @param content - The content to hash (can be empty)
 * @returns SHA-256 hash of the content
 */
export function generateContentHash(content: string | null | undefined): string {
  const text = content ?? "";
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Canonicalize a URL for deduplication.
 *
 * - Removes trailing slashes
 * - Normalizes protocol to https
 * - Removes common tracking parameters
 *
 * @param rawUrl - The raw URL to canonicalize
 * @returns The canonical URL
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);

    // Normalize to https
    url.protocol = "https:";

    // Remove common tracking parameters
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "ref"];
    trackingParams.forEach((param) => url.searchParams.delete(param));

    // Remove trailing slash
    let canonical = url.toString();
    if (canonical.endsWith("/")) {
      canonical = canonical.slice(0, -1);
    }

    return canonical;
  } catch {
    // If URL parsing fails, return as-is
    return rawUrl;
  }
}

/**
 * Extract domain from URL.
 *
 * @param url - The URL to extract domain from
 * @returns The domain (e.g., "news.ycombinator.com")
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * Determine trust tier based on domain.
 *
 * @param domain - The domain to evaluate
 * @returns The appropriate TrustTier
 */
export function determineTrustTier(domain: string): TrustTier {
  // Authoritative sources
  const authoritative = [
    "openai.com",
    "anthropic.com",
    "deepmind.com",
    "google.com",
    "microsoft.com",
    "meta.com",
    "arxiv.org",
    "github.com",
    "huggingface.co",
  ];

  // Standard sources
  const standard = [
    "techcrunch.com",
    "theverge.com",
    "wired.com",
    "arstechnica.com",
    "news.ycombinator.com",
  ];

  if (authoritative.some((d) => domain.includes(d))) {
    return TrustTier.AUTHORITATIVE;
  }

  if (standard.some((d) => domain.includes(d))) {
    return TrustTier.STANDARD;
  }

  return TrustTier.LOW;
}

/**
 * Create or find an EvidenceSource and create a new EvidenceSnapshot.
 *
 * This is the core function for building the evidence chain:
 * 1. Find or create EvidenceSource by canonical URL
 * 2. Create a new EvidenceSnapshot with the content
 *
 * @param url - The source URL
 * @param title - The content title
 * @param content - Optional full text content
 * @param author - Optional author name
 * @param publishedAt - Optional publication date
 * @returns The created EvidenceSnapshot
 */
export async function createEvidenceChain(
  url: string,
  title: string,
  content?: string | null,
  author?: string | null,
  publishedAt?: Date | null
): Promise<EvidenceSnapshot> {
  const canonicalUrl = canonicalizeUrl(url);
  const domain = extractDomain(url);
  const trustTier = determineTrustTier(domain);
  const contentHash = generateContentHash(content);

  // Find or create the EvidenceSource
  const source = await prisma.evidenceSource.upsert({
    where: { canonicalUrl },
    update: {}, // No updates needed if exists
    create: {
      rawUrl: url,
      canonicalUrl,
      domain,
      trustTier,
    },
  });

  // Create a new snapshot for this retrieval
  const snapshot = await prisma.evidenceSnapshot.create({
    data: {
      sourceId: source.id,
      title,
      author: author ?? null,
      publishedAt: publishedAt ?? null,
      contentHash,
      fullText: content ?? null,
      httpStatus: 200, // Assume successful for backfill
      // headers is optional and defaults to null in Prisma
    },
  });

  return snapshot;
}

/**
 * Create an Event from source data with evidence chain.
 *
 * @param params - The event creation parameters
 * @returns The created Event or null if duplicate
 */
export async function createEventWithEvidence(params: {
  title: string;
  occurredAt: Date;
  sourceType: SourceType;
  sourceId: string;
  url: string;
  content?: string | null;
  author?: string | null;
}): Promise<Event | null> {
  const { title, occurredAt, sourceType, sourceId, url, content, author } =
    params;

  const fingerprint = generateFingerprint(title, occurredAt, sourceType);

  // Check if event already exists (deduplication)
  const existing = await prisma.event.findUnique({
    where: { fingerprint },
  });

  if (existing) {
    return null; // Skip duplicate
  }

  // Create the evidence chain
  const snapshot = await createEvidenceChain(
    url,
    title,
    content,
    author,
    occurredAt
  );

  // Create the event with initial status change
  const event = await prisma.event.create({
    data: {
      fingerprint,
      title,
      occurredAt,
      sourceType,
      sourceId,
      status: EventStatus.RAW,
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: EventStatus.RAW,
          reason: "Backfill from legacy data",
        },
      },
      evidence: {
        create: {
          snapshotId: snapshot.id,
          role: EvidenceRole.PRIMARY,
        },
      },
    },
  });

  return event;
}

// ============================================================================
// SOURCE-SPECIFIC BACKFILL FUNCTIONS
// ============================================================================

/**
 * Backfill Hacker News entries.
 *
 * Expected source table structure (hn_entries):
 * - id: string
 * - title: string
 * - url: string (may be null for text posts)
 * - text: string (optional, for text posts)
 * - by: string (author)
 * - time: number (unix timestamp)
 * - score: number
 *
 * TODO: Adjust field names when actual table structure is confirmed
 */
export async function backfillHNEntries(): Promise<BackfillStats> {
  console.log("Starting HN entries backfill...");
  const stats = createStats();

  // TODO: Implement when HN table structure is confirmed
  // Example implementation:
  //
  // const entries = await prisma.hnEntry.findMany({
  //   orderBy: { time: 'asc' },
  // });
  //
  // for (const entry of entries) {
  //   stats.processed++;
  //
  //   try {
  //     // HN text posts use the HN item URL as the source
  //     const url = entry.url || `https://news.ycombinator.com/item?id=${entry.id}`;
  //     const occurredAt = new Date(entry.time * 1000);
  //
  //     const event = await createEventWithEvidence({
  //       title: entry.title,
  //       occurredAt,
  //       sourceType: SourceType.HN,
  //       sourceId: entry.id,
  //       url,
  //       content: entry.text,
  //       author: entry.by,
  //     });
  //
  //     if (event) {
  //       stats.created++;
  //     } else {
  //       stats.skipped++; // Duplicate
  //     }
  //
  //     if (stats.processed % LOG_INTERVAL === 0) {
  //       console.log(`  HN: Processed ${stats.processed} entries...`);
  //     }
  //   } catch (error) {
  //     stats.errors++;
  //     console.error(`  HN Error [${entry.id}]:`, error);
  //   }
  // }

  console.log(
    `HN backfill complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.errors} errors`
  );
  return stats;
}

/**
 * Backfill GitHub entries.
 *
 * Expected source table structure (github_entries):
 * - id: string
 * - name: string (repo name)
 * - full_name: string (owner/repo)
 * - description: string
 * - html_url: string
 * - created_at: datetime
 * - pushed_at: datetime
 * - stargazers_count: number
 * - owner: json { login: string }
 *
 * TODO: Adjust field names when actual table structure is confirmed
 */
export async function backfillGitHubEntries(): Promise<BackfillStats> {
  console.log("Starting GitHub entries backfill...");
  const stats = createStats();

  // TODO: Implement when GitHub table structure is confirmed
  // Example implementation:
  //
  // const entries = await prisma.githubEntry.findMany({
  //   orderBy: { created_at: 'asc' },
  // });
  //
  // for (const entry of entries) {
  //   stats.processed++;
  //
  //   try {
  //     // Use pushed_at as the event date (most recent activity)
  //     const occurredAt = entry.pushed_at || entry.created_at;
  //
  //     const event = await createEventWithEvidence({
  //       title: `${entry.full_name}: ${entry.description || 'New repository'}`,
  //       occurredAt,
  //       sourceType: SourceType.GITHUB,
  //       sourceId: entry.id,
  //       url: entry.html_url,
  //       content: entry.description,
  //       author: entry.owner?.login,
  //     });
  //
  //     if (event) {
  //       stats.created++;
  //     } else {
  //       stats.skipped++; // Duplicate
  //     }
  //
  //     if (stats.processed % LOG_INTERVAL === 0) {
  //       console.log(`  GitHub: Processed ${stats.processed} entries...`);
  //     }
  //   } catch (error) {
  //     stats.errors++;
  //     console.error(`  GitHub Error [${entry.id}]:`, error);
  //   }
  // }

  console.log(
    `GitHub backfill complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.errors} errors`
  );
  return stats;
}

/**
 * Backfill arXiv entries.
 *
 * Expected source table structure (arxiv_entries):
 * - id: string (arXiv ID like "2401.12345")
 * - title: string
 * - summary: string (abstract)
 * - authors: string[] or json
 * - published: datetime
 * - updated: datetime
 * - pdf_url: string
 * - abs_url: string (abstract page URL)
 *
 * TODO: Adjust field names when actual table structure is confirmed
 */
export async function backfillArxivEntries(): Promise<BackfillStats> {
  console.log("Starting arXiv entries backfill...");
  const stats = createStats();

  // TODO: Implement when arXiv table structure is confirmed
  // Example implementation:
  //
  // const entries = await prisma.arxivEntry.findMany({
  //   orderBy: { published: 'asc' },
  // });
  //
  // for (const entry of entries) {
  //   stats.processed++;
  //
  //   try {
  //     // Extract first author for the author field
  //     const authors = Array.isArray(entry.authors)
  //       ? entry.authors
  //       : JSON.parse(entry.authors || '[]');
  //     const firstAuthor = authors[0] || 'Unknown';
  //
  //     const event = await createEventWithEvidence({
  //       title: entry.title,
  //       occurredAt: entry.published,
  //       sourceType: SourceType.ARXIV,
  //       sourceId: entry.id,
  //       url: entry.abs_url || `https://arxiv.org/abs/${entry.id}`,
  //       content: entry.summary,
  //       author: firstAuthor,
  //     });
  //
  //     if (event) {
  //       stats.created++;
  //     } else {
  //       stats.skipped++; // Duplicate
  //     }
  //
  //     if (stats.processed % LOG_INTERVAL === 0) {
  //       console.log(`  arXiv: Processed ${stats.processed} entries...`);
  //     }
  //   } catch (error) {
  //     stats.errors++;
  //     console.error(`  arXiv Error [${entry.id}]:`, error);
  //   }
  // }

  console.log(
    `arXiv backfill complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.errors} errors`
  );
  return stats;
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

interface BackfillResult {
  hn: BackfillStats;
  github: BackfillStats;
  arxiv: BackfillStats;
  totalCreated: number;
  totalSkipped: number;
  totalErrors: number;
  durationMs: number;
}

/**
 * Run all backfill operations.
 *
 * This is the main entry point for the backfill script.
 * It runs each source type backfill sequentially and reports
 * overall statistics.
 */
export async function runBackfill(): Promise<BackfillResult> {
  console.log("=".repeat(60));
  console.log("GenAI Observatory - Data Backfill");
  console.log("=".repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("");

  const startTime = Date.now();

  // Run backfills sequentially to avoid overwhelming the database
  const hnStats = await backfillHNEntries();
  console.log("");

  const githubStats = await backfillGitHubEntries();
  console.log("");

  const arxivStats = await backfillArxivEntries();
  console.log("");

  const durationMs = Date.now() - startTime;

  const result: BackfillResult = {
    hn: hnStats,
    github: githubStats,
    arxiv: arxivStats,
    totalCreated:
      hnStats.created + githubStats.created + arxivStats.created,
    totalSkipped:
      hnStats.skipped + githubStats.skipped + arxivStats.skipped,
    totalErrors: hnStats.errors + githubStats.errors + arxivStats.errors,
    durationMs,
  };

  // Print summary
  console.log("=".repeat(60));
  console.log("BACKFILL COMPLETE");
  console.log("=".repeat(60));
  console.log(`Duration: ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`Total events created: ${result.totalCreated}`);
  console.log(`Total duplicates skipped: ${result.totalSkipped}`);
  console.log(`Total errors: ${result.totalErrors}`);
  console.log("");
  console.log("Breakdown:");
  console.log(
    `  HN:     ${hnStats.created} created, ${hnStats.skipped} skipped, ${hnStats.errors} errors`
  );
  console.log(
    `  GitHub: ${githubStats.created} created, ${githubStats.skipped} skipped, ${githubStats.errors} errors`
  );
  console.log(
    `  arXiv:  ${arxivStats.created} created, ${arxivStats.skipped} skipped, ${arxivStats.errors} errors`
  );
  console.log("");

  return result;
}

/**
 * Main entry point when running as a script.
 */
async function main(): Promise<void> {
  try {
    await runBackfill();
  } catch (error) {
    console.error("Backfill failed with error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
