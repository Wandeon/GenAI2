// ============================================================================
// DAILY BRIEFING TYPES
// ============================================================================
// Type definitions for daily-briefing processor
// Split from daily-briefing.ts per file size guidelines (max 200 lines utils)

export interface DailyBriefingJob {
  date: string; // ISO date string YYYY-MM-DD
}

export interface DailyBriefingInput {
  date: string;
}

export interface DailyBriefingResult {
  success: boolean;
  briefingId?: string;
  eventCount: number;
  error?: string;
}

// Event data loaded for briefing generation
export interface EventForBriefing {
  id: string;
  title: string;
  titleHr: string | null;
  importance: number;
  occurredAt: Date;
  artifacts: Array<{
    artifactType: string;
    payload: unknown;
  }>;
  evidence: Array<{
    snapshot: {
      source: {
        id: string;
      };
    };
  }>;
  mentions: Array<{
    entity: {
      name: string;
    };
  }>;
}
