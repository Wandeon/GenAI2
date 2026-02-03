// ============================================================================
// TOPIC ASSIGN TYPES
// ============================================================================
// Type definitions for topic assignment processor
// Split from topic-assign.ts per file size guidelines (max 200 lines utils)

export interface TopicAssignJob {
  eventId: string;
}

export interface TopicAssignInput {
  eventId: string;
}

export interface TopicAssignResult {
  success: boolean;
  eventId: string;
  topicsAssigned: number;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

export interface EvidenceSnapshot {
  id: string;
  title: string | null;
  fullText: string | null;
  publishedAt: Date | null;
}

export interface EventEvidence {
  id: string;
  role: string;
  snapshot: EvidenceSnapshot;
}

export interface TopicData {
  id: string;
  slug: string;
  name: string;
}

export interface EventWithEvidence {
  id: string;
  title: string;
  titleHr: string | null;
  status: string;
  occurredAt: Date;
  sourceType: string;
  sourceId: string;
  evidence: EventEvidence[];
}
