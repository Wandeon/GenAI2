import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";

// ============================================================================
// EVIDENCE SNAPSHOT PROCESSOR
// ============================================================================
// Creates immutable snapshots of source URLs
// Implements Architecture Constitution #1: Evidence First

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Define TrustTier locally to avoid mock issues in tests
// This matches the Prisma enum TrustTier
export type TrustTier = "AUTHORITATIVE" | "STANDARD" | "LOW";

export interface EvidenceSnapshotJob {
  url: string;
  sourceType: string;
  sourceId: string;
}

export interface EvidenceSnapshotInput {
  url: string;
  title?: string;
  content?: string;
  author?: string;
  publishedAt?: Date;
  httpStatus?: number;
  headers?: Record<string, string>;
  sourceType: string;
  sourceId: string;
}

export interface EvidenceSnapshotResult {
  sourceId: string;
  snapshotId: string;
  isNewSource: boolean;
}

// ============================================================================
// TRACKING PARAMETERS TO REMOVE
// ============================================================================

const TRACKING_PARAMS = [
  // UTM parameters
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  // Social/referrer
  "ref",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "twclid",
  // Analytics
  "_ga",
  "_gl",
  "mc_cid",
  "mc_eid",
];

// ============================================================================
// AUTHORITATIVE AND LOW-TRUST DOMAINS
// ============================================================================

const AUTHORITATIVE_DOMAINS = [
  "openai.com",
  "anthropic.com",
  "deepmind.google",
  "ai.meta.com",
  "ai.google",
  "microsoft.com",
  "nvidia.com",
  "huggingface.co",
];

const LOW_TRUST_DOMAINS = [
  "reddit.com",
  "twitter.com",
  "x.com",
  "news.ycombinator.com",
];

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for evidence-snapshot processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 * TODO: Replace with proper logger when worker package has one.
 */
function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[evidence-snapshot] ${message}`);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Canonicalize a URL for deduplication.
 *
 * - Removes tracking parameters (utm_*, ref, fbclid, etc.)
 * - Normalizes protocol to https
 * - Removes trailing slash (except for root)
 *
 * @param rawUrl - The raw URL to canonicalize
 * @returns The canonical URL
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);

    // Normalize to https
    url.protocol = "https:";

    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }

    // Build the URL string
    let canonical = url.toString();

    // Remove trailing slash (but not for root paths like "https://example.com/")
    if (canonical.endsWith("/") && url.pathname !== "/") {
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
 * - Removes www. prefix
 *
 * @param url - The URL to extract domain from
 * @returns The domain (e.g., "openai.com")
 */
export function extractDomain(url: string): string {
  try {
    let hostname = new URL(url).hostname;
    // Remove www. prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return "unknown";
  }
}

/**
 * Determine trust tier based on domain.
 *
 * - AUTHORITATIVE: Official AI company sites
 * - LOW: Social media, aggregators
 * - STANDARD: Everything else
 *
 * @param domain - The domain to evaluate
 * @returns The appropriate TrustTier
 */
export function determineTrustTier(domain: string): TrustTier {
  // Check authoritative domains
  if (AUTHORITATIVE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return "AUTHORITATIVE";
  }

  // Check low-trust domains
  if (LOW_TRUST_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return "LOW";
  }

  // Default to standard
  return "STANDARD";
}

/**
 * Generate a SHA-256 content hash for deduplication.
 *
 * @param content - The content to hash
 * @returns SHA-256 hash as hex string
 */
export function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Create an EvidenceSnapshot with associated EvidenceSource.
 *
 * This is the core function for building the evidence chain:
 * 1. Canonicalize URL
 * 2. Extract domain
 * 3. Determine trust tier
 * 4. Generate content hash
 * 5. Upsert EvidenceSource
 * 6. Create EvidenceSnapshot
 *
 * @param input - The evidence snapshot input data
 * @returns The created snapshot info
 */
export async function createEvidenceSnapshot(
  input: EvidenceSnapshotInput
): Promise<EvidenceSnapshotResult> {
  const { url, title, content, author, publishedAt, httpStatus, headers } = input;

  // Canonicalize URL
  const canonicalUrl = canonicalizeUrl(url);

  // Extract domain (without www.)
  const domain = extractDomain(url);

  // Determine trust tier
  const trustTier = determineTrustTier(domain);

  // Generate content hash
  const contentHash = generateContentHash(content ?? "");

  // Upsert EvidenceSource (find existing or create new)
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

  // Check if this is a new source (created just now)
  // We can determine this by checking if createdAt is within the last second
  // Handle case where createdAt might not exist (in tests with mocks)
  const isNewSource = source.createdAt
    ? Date.now() - source.createdAt.getTime() < 1000
    : false;

  // Create EvidenceSnapshot
  const snapshot = await prisma.evidenceSnapshot.create({
    data: {
      sourceId: source.id,
      title: title ?? null,
      author: author ?? null,
      publishedAt: publishedAt ?? null,
      contentHash,
      fullText: content ?? null,
      httpStatus: httpStatus ?? null,
      headers: headers ?? undefined,
    },
  });

  return {
    sourceId: source.id,
    snapshotId: snapshot.id,
    isNewSource,
  };
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process an evidence snapshot job from the queue.
 *
 * @param job - The BullMQ job
 */
export async function processEvidenceSnapshot(
  job: Job<EvidenceSnapshotJob>
): Promise<void> {
  const { url, sourceType, sourceId } = job.data;

  log(`Processing evidence snapshot for ${url}`);

  // Create the evidence snapshot
  const result = await createEvidenceSnapshot({
    url,
    sourceType,
    sourceId,
  });

  log(
    `Evidence snapshot created: source=${result.sourceId}, snapshot=${result.snapshotId}, isNew=${result.isNewSource}`
  );
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for evidence snapshot processing.
 *
 * @param connection - Redis connection
 * @returns The worker instance
 */
export function createEvidenceSnapshotWorker(connection: ConnectionOptions): Worker {
  return new Worker("evidence-snapshot", processEvidenceSnapshot, {
    connection,
  });
}
