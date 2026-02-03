// ============================================================================
// WATCHLIST MATCH TYPES
// ============================================================================
// Type definitions for watchlist match processor
// Split from watchlist-match.ts per file size guidelines (max 200 lines utils)

export interface WatchlistMatchJob {
  eventId: string;
}

export interface WatchlistMatchInput {
  eventId: string;
}

export interface WatchlistMatchResult {
  success: boolean;
  eventId: string;
  matchesCreated: number;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

export interface MatchDetail {
  watchlistId: string;
  matchType: "ENTITY" | "TOPIC" | "KEYWORD";
  matchedValue: string;
}

// Types for loaded event data
export interface EventWithRelations {
  id: string;
  title: string;
  status: string;
  mentions: Array<{
    entityId: string;
    entity: {
      id: string;
      name: string;
    };
  }>;
  topics: Array<{
    topicId: string;
    topic: {
      id: string;
      name: string;
    };
  }>;
}

// Types for loaded watchlist data
export interface WatchlistWithCriteria {
  id: string;
  name: string;
  entities: Array<{
    entityId: string;
  }>;
  topics: Array<{
    topicId: string;
  }>;
  keywords: string[];
}
