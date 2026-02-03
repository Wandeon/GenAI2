// ============================================================================
// WATCHLIST MATCH UTILITIES
// ============================================================================
// Helper functions for watchlist match processor
// Split from watchlist-match.ts per file size guidelines (max 200 lines utils)

import type {
  EventWithRelations,
  WatchlistWithCriteria,
  MatchDetail,
} from "./watchlist-match.types";

// ============================================================================
// CONSTANTS
// ============================================================================

export const PROCESSOR_NAME = "watchlist-match";

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for watchlist-match processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 */
export function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[watchlist-match] ${message}`);
}

// ============================================================================
// MATCH CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if the event mentions any entity from the watchlist.
 *
 * @param event - The event with its entity mentions
 * @param watchlist - The watchlist with its entity criteria
 * @returns Array of match details for entity matches
 */
export function checkEntityMatches(
  event: EventWithRelations,
  watchlist: WatchlistWithCriteria
): MatchDetail[] {
  const matches: MatchDetail[] = [];

  // Build set of event entity IDs for efficient lookup
  const eventEntityIds = new Set(event.mentions.map((m) => m.entityId));

  // Check each watchlist entity
  for (const watchlistEntity of watchlist.entities) {
    if (eventEntityIds.has(watchlistEntity.entityId)) {
      // Find the entity name from the event mentions
      const mention = event.mentions.find(
        (m) => m.entityId === watchlistEntity.entityId
      );
      matches.push({
        watchlistId: watchlist.id,
        matchType: "ENTITY",
        matchedValue: mention?.entity.name ?? watchlistEntity.entityId,
      });
    }
  }

  return matches;
}

/**
 * Check if the event has any topic from the watchlist.
 *
 * @param event - The event with its topics
 * @param watchlist - The watchlist with its topic criteria
 * @returns Array of match details for topic matches
 */
export function checkTopicMatches(
  event: EventWithRelations,
  watchlist: WatchlistWithCriteria
): MatchDetail[] {
  const matches: MatchDetail[] = [];

  // Build set of event topic IDs for efficient lookup
  const eventTopicIds = new Set(event.topics.map((t) => t.topicId));

  // Check each watchlist topic
  for (const watchlistTopic of watchlist.topics) {
    if (eventTopicIds.has(watchlistTopic.topicId)) {
      // Find the topic name from the event topics
      const eventTopic = event.topics.find(
        (t) => t.topicId === watchlistTopic.topicId
      );
      matches.push({
        watchlistId: watchlist.id,
        matchType: "TOPIC",
        matchedValue: eventTopic?.topic.name ?? watchlistTopic.topicId,
      });
    }
  }

  return matches;
}

/**
 * Check if the event title contains any keyword from the watchlist.
 * Uses case-insensitive matching.
 *
 * @param event - The event with its title
 * @param watchlist - The watchlist with its keyword criteria
 * @returns Array of match details for keyword matches
 */
export function checkKeywordMatches(
  event: EventWithRelations,
  watchlist: WatchlistWithCriteria
): MatchDetail[] {
  const matches: MatchDetail[] = [];

  // Lowercase title for case-insensitive matching
  const titleLower = event.title.toLowerCase();

  // Check each keyword
  for (const keyword of watchlist.keywords) {
    if (titleLower.includes(keyword.toLowerCase())) {
      matches.push({
        watchlistId: watchlist.id,
        matchType: "KEYWORD",
        matchedValue: keyword,
      });
    }
  }

  return matches;
}

/**
 * Find all matches between an event and a watchlist.
 * Returns all match details (OR logic - any match counts).
 *
 * @param event - The event to check
 * @param watchlist - The watchlist to check against
 * @returns Array of all match details
 */
export function findAllMatches(
  event: EventWithRelations,
  watchlist: WatchlistWithCriteria
): MatchDetail[] {
  const entityMatches = checkEntityMatches(event, watchlist);
  const topicMatches = checkTopicMatches(event, watchlist);
  const keywordMatches = checkKeywordMatches(event, watchlist);

  return [...entityMatches, ...topicMatches, ...keywordMatches];
}

/**
 * Check if a watchlist has any criteria defined.
 *
 * @param watchlist - The watchlist to check
 * @returns True if the watchlist has at least one criterion
 */
export function hasAnyCriteria(watchlist: WatchlistWithCriteria): boolean {
  return (
    watchlist.entities.length > 0 ||
    watchlist.topics.length > 0 ||
    watchlist.keywords.length > 0
  );
}
