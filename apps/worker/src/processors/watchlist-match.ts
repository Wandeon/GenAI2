import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";

// Local imports
import type {
  WatchlistMatchJob,
  WatchlistMatchInput,
  WatchlistMatchResult,
  EventWithRelations,
  WatchlistWithCriteria,
} from "./watchlist-match.types";
import {
  PROCESSOR_NAME,
  log,
  findAllMatches,
  hasAnyCriteria,
} from "./watchlist-match.utils";

// Re-export types for external consumers
export type {
  WatchlistMatchJob,
  WatchlistMatchInput,
  WatchlistMatchResult,
} from "./watchlist-match.types";

// Re-export utilities that may be needed by tests
export {
  checkEntityMatches,
  checkTopicMatches,
  checkKeywordMatches,
  findAllMatches,
  hasAnyCriteria,
} from "./watchlist-match.utils";

// ============================================================================
// WATCHLIST MATCH PROCESSOR
// ============================================================================
// Matches events to user watchlists and creates notification records
// Implements Architecture Constitution #5
//
// #5: SERVER-SIDE IDENTITY - Watchlists tied to server sessions
//
// NO LLM calls - this is a pure database/logic processor

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Match an event to all watchlists and create match records.
 *
 * This function:
 * 1. Loads the event with its entities and topics
 * 2. Skips if not in PUBLISHED status
 * 3. Loads all watchlists with their criteria
 * 4. Matches event to each watchlist by entity, topic, or keyword
 * 5. Creates WatchlistMatch records with seen=false for notifications
 *
 * @param input - The match input with eventId
 * @returns Result with matches created count
 */
export async function matchWatchlists(
  input: WatchlistMatchInput
): Promise<WatchlistMatchResult> {
  const { eventId } = input;

  log(`Starting watchlist matching for event ${eventId}`);

  return prisma.$transaction(async (tx) => {
    // Load event with relations
    const event = (await tx.event.findUnique({
      where: { id: eventId },
      include: {
        mentions: {
          include: {
            entity: true,
          },
        },
        topics: {
          include: {
            topic: true,
          },
        },
      },
    })) as EventWithRelations | null;

    // Check if event exists
    if (!event) {
      log(`Event ${eventId} not found`);
      return {
        success: false,
        eventId,
        matchesCreated: 0,
        error: `Event ${eventId} not found`,
      };
    }

    // Check status - only process PUBLISHED events
    if (event.status !== "PUBLISHED") {
      log(`Event ${eventId} not in PUBLISHED status (current: ${event.status}), skipping`);
      return {
        success: true,
        eventId,
        matchesCreated: 0,
        skipped: true,
        skipReason: `Event not in PUBLISHED status (current: ${event.status})`,
      };
    }

    // Load all watchlists with their criteria
    const watchlists = (await tx.watchlist.findMany({
      include: {
        entities: true,
        topics: true,
      },
    })) as WatchlistWithCriteria[];

    log(`Found ${watchlists.length} watchlists to check`);

    // Track matches created
    let matchesCreated = 0;

    // Check each watchlist
    for (const watchlist of watchlists) {
      // Skip watchlists with no criteria
      if (!hasAnyCriteria(watchlist)) {
        log(`Watchlist ${watchlist.id} has no criteria, skipping`);
        continue;
      }

      // Find all matches
      const matches = findAllMatches(event, watchlist);

      // If any matches found, create a WatchlistMatch record
      if (matches.length > 0) {
        log(
          `Watchlist ${watchlist.id} matched event ${eventId}: ${matches.map((m) => `${m.matchType}:${m.matchedValue}`).join(", ")}`
        );

        // Use upsert to handle potential duplicates (idempotent)
        await tx.watchlistMatch.upsert({
          where: {
            watchlistId_eventId: {
              watchlistId: watchlist.id,
              eventId,
            },
          },
          create: {
            watchlistId: watchlist.id,
            eventId,
            seen: false,
          },
          update: {
            // Don't update if already exists - keep original matchedAt and seen status
          },
        });

        matchesCreated++;
      }
    }

    log(`Event ${eventId} watchlist matching complete: ${matchesCreated} matches created`);

    return {
      success: true,
      eventId,
      matchesCreated,
    };
  });
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process a watchlist match job from the queue.
 *
 * @param job - The BullMQ job containing event data
 */
export async function processWatchlistMatch(
  job: Job<WatchlistMatchJob>
): Promise<WatchlistMatchResult> {
  const { eventId } = job.data;

  log(`Processing watchlist matching for ${eventId}`);

  return matchWatchlists({ eventId });
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for watchlist match processing.
 *
 * @param connection - Redis connection options
 * @returns The worker instance
 */
export function createWatchlistMatchWorker(connection: ConnectionOptions): Worker {
  return new Worker("watchlist-match", processWatchlistMatch, {
    connection,
  });
}

// Suppress unused export warning for PROCESSOR_NAME
void PROCESSOR_NAME;
