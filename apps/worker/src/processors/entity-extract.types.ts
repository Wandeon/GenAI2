// ============================================================================
// ENTITY EXTRACT TYPES
// ============================================================================
// Type definitions for entity extraction processor
// Split from entity-extract.ts per file size guidelines (max 200 lines utils)

export interface EntityExtractJob {
  eventId: string;
}

export interface EntityExtractInput {
  eventId: string;
}

export interface EntityExtractResult {
  success: boolean;
  eventId: string;
  entitiesExtracted: number;
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
