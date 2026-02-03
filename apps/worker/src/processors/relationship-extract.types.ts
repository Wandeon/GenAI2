// ============================================================================
// RELATIONSHIP EXTRACT TYPES
// ============================================================================
// Type definitions for relationship extraction processor
// Split from relationship-extract.ts per file size guidelines (max 200 lines utils)

import type { RelationType, TrustTier } from "@genai/shared/graph-safety";

export interface RelationshipExtractJob {
  eventId: string;
}

export interface RelationshipExtractInput {
  eventId: string;
}

export interface RelationshipExtractResult {
  success: boolean;
  eventId: string;
  relationshipsExtracted: number;
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

export interface EvidenceSource {
  trustTier: TrustTier;
}

export interface EventEvidence {
  id: string;
  role: string;
  snapshot: EvidenceSnapshot & {
    source: EvidenceSource;
  };
}

export interface EntityMention {
  id: string;
  entityId: string;
  role: string;
  confidence: number;
  entity: {
    id: string;
    name: string;
    type: string;
  };
}

export interface EventWithEntities {
  id: string;
  title: string;
  titleHr: string | null;
  status: string;
  occurredAt: Date;
  sourceType: string;
  sourceId: string;
  evidence: EventEvidence[];
  mentions: EntityMention[];
}

export interface ExtractedRelationship {
  sourceEntity: string;
  targetEntity: string;
  type: RelationType;
  confidence: number;
}
