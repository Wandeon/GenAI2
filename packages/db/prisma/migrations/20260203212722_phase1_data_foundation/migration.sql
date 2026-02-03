-- Phase 1: Data Foundation Migration
-- Creates all core models for GenAI Observatory
--
-- Models included:
-- - Evidence layer: EvidenceSource, EvidenceSnapshot
-- - Event layer: Event, EventStatusChange, EventEvidence
-- - Artifact layer: EventArtifact, LLMRun
-- - Entity layer: Entity, EntityAlias, EntityMention
-- - Relationship layer: Relationship
-- - Topic layer: Topic, TopicAlias, EventTopic
-- - Session layer: AnonSession, Watchlist, WatchlistEntity, WatchlistTopic, WatchlistMatch

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('AUTHORITATIVE', 'STANDARD', 'LOW');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('HN', 'GITHUB', 'ARXIV', 'NEWSAPI', 'REDDIT', 'LEADERBOARD', 'HUGGINGFACE', 'PRODUCTHUNT', 'DEVTO', 'YOUTUBE', 'LOBSTERS');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('RAW', 'ENRICHED', 'VERIFIED', 'PUBLISHED', 'QUARANTINED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('BREAKING', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "EvidenceRole" AS ENUM ('PRIMARY', 'SUPPORTING', 'CONTEXT');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('HEADLINE', 'SUMMARY', 'GM_TAKE', 'WHY_MATTERS', 'ENTITY_EXTRACT', 'TOPIC_ASSIGN');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('COMPANY', 'LAB', 'MODEL', 'PRODUCT', 'PERSON', 'REGULATION', 'DATASET', 'BENCHMARK');

-- CreateEnum
CREATE TYPE "MentionRole" AS ENUM ('SUBJECT', 'OBJECT', 'MENTIONED');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('PENDING', 'APPROVED', 'QUARANTINED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('RELEASED', 'ANNOUNCED', 'PUBLISHED', 'PARTNERED', 'INTEGRATED', 'FUNDED', 'ACQUIRED', 'BANNED', 'BEATS', 'CRITICIZED');

-- CreateEnum
CREATE TYPE "TopicOrigin" AS ENUM ('MANUAL', 'LLM', 'RULE');

-- ============================================================================
-- EVIDENCE LAYER
-- ============================================================================

-- CreateTable
CREATE TABLE "evidence_sources" (
    "id" TEXT NOT NULL,
    "rawUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "trustTier" "TrustTier" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_snapshots" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "fullText" TEXT,
    "httpStatus" INTEGER,
    "headers" JSONB,

    CONSTRAINT "evidence_snapshots_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- EVENT LAYER
-- ============================================================================

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "titleHr" TEXT,
    "impactLevel" "ImpactLevel" NOT NULL DEFAULT 'MEDIUM',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "EventStatus" NOT NULL DEFAULT 'RAW',
    "sourceType" "SourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ingestRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_status_changes" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fromStatus" "EventStatus",
    "toStatus" "EventStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,

    CONSTRAINT "event_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_evidence" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "role" "EvidenceRole" NOT NULL DEFAULT 'PRIMARY',

    CONSTRAINT "event_evidence_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- ARTIFACT LAYER
-- ============================================================================

-- CreateTable
CREATE TABLE "event_artifacts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "artifactType" "ArtifactType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "promptHash" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "processorName" TEXT NOT NULL,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_runs_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- ENTITY LAYER
-- ============================================================================

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHr" TEXT,
    "slug" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "description" TEXT,
    "descriptionHr" TEXT,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_aliases" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "entity_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_mentions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" "MentionRole" NOT NULL DEFAULT 'MENTIONED',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "entity_mentions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- RELATIONSHIP LAYER
-- ============================================================================

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "statusReason" TEXT,
    "modelConfidence" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- TOPIC LAYER
-- ============================================================================

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHr" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_aliases" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "topic_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_topics" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "origin" "TopicOrigin" NOT NULL DEFAULT 'LLM',

    CONSTRAINT "event_topics_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- SESSION & WATCHLIST LAYER
-- ============================================================================

-- CreateTable
CREATE TABLE "anon_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEventCursor" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anon_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_entities" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,

    CONSTRAINT "watchlist_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_topics" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "watchlist_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_matches" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "watchlist_matches_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Evidence layer indexes
CREATE UNIQUE INDEX "evidence_sources_canonicalUrl_key" ON "evidence_sources"("canonicalUrl");
CREATE INDEX "evidence_sources_canonicalUrl_idx" ON "evidence_sources"("canonicalUrl");
CREATE INDEX "evidence_sources_domain_idx" ON "evidence_sources"("domain");

CREATE INDEX "evidence_snapshots_sourceId_idx" ON "evidence_snapshots"("sourceId");
CREATE INDEX "evidence_snapshots_contentHash_idx" ON "evidence_snapshots"("contentHash");
CREATE INDEX "evidence_snapshots_retrievedAt_idx" ON "evidence_snapshots"("retrievedAt");

-- Event layer indexes
CREATE UNIQUE INDEX "events_fingerprint_key" ON "events"("fingerprint");
CREATE INDEX "events_occurredAt_idx" ON "events"("occurredAt");
CREATE INDEX "events_importance_idx" ON "events"("importance");
CREATE INDEX "events_impactLevel_idx" ON "events"("impactLevel");
CREATE INDEX "events_status_idx" ON "events"("status");
CREATE INDEX "events_fingerprint_idx" ON "events"("fingerprint");

CREATE INDEX "event_status_changes_eventId_idx" ON "event_status_changes"("eventId");

CREATE UNIQUE INDEX "event_evidence_eventId_snapshotId_key" ON "event_evidence"("eventId", "snapshotId");

-- Artifact layer indexes
CREATE INDEX "event_artifacts_eventId_idx" ON "event_artifacts"("eventId");
CREATE INDEX "event_artifacts_runId_idx" ON "event_artifacts"("runId");
CREATE UNIQUE INDEX "event_artifacts_eventId_artifactType_version_key" ON "event_artifacts"("eventId", "artifactType", "version");

CREATE INDEX "llm_runs_createdAt_idx" ON "llm_runs"("createdAt");
CREATE INDEX "llm_runs_eventId_idx" ON "llm_runs"("eventId");
CREATE INDEX "llm_runs_processorName_idx" ON "llm_runs"("processorName");

-- Entity layer indexes
CREATE UNIQUE INDEX "entities_slug_key" ON "entities"("slug");
CREATE INDEX "entities_type_idx" ON "entities"("type");
CREATE INDEX "entities_importance_idx" ON "entities"("importance");
CREATE INDEX "entities_slug_idx" ON "entities"("slug");
CREATE UNIQUE INDEX "entities_name_type_key" ON "entities"("name", "type");

CREATE INDEX "entity_aliases_alias_idx" ON "entity_aliases"("alias");
CREATE UNIQUE INDEX "entity_aliases_entityId_alias_key" ON "entity_aliases"("entityId", "alias");

CREATE UNIQUE INDEX "entity_mentions_eventId_entityId_key" ON "entity_mentions"("eventId", "entityId");

-- Relationship layer indexes
CREATE INDEX "relationships_sourceId_idx" ON "relationships"("sourceId");
CREATE INDEX "relationships_targetId_idx" ON "relationships"("targetId");
CREATE INDEX "relationships_type_idx" ON "relationships"("type");
CREATE INDEX "relationships_status_idx" ON "relationships"("status");

-- Topic layer indexes
CREATE UNIQUE INDEX "topics_name_key" ON "topics"("name");
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

CREATE UNIQUE INDEX "topic_aliases_alias_key" ON "topic_aliases"("alias");

CREATE UNIQUE INDEX "event_topics_eventId_topicId_key" ON "event_topics"("eventId", "topicId");

-- Session layer indexes
CREATE UNIQUE INDEX "anon_sessions_token_key" ON "anon_sessions"("token");
CREATE INDEX "anon_sessions_token_idx" ON "anon_sessions"("token");

CREATE UNIQUE INDEX "watchlist_entities_watchlistId_entityId_key" ON "watchlist_entities"("watchlistId", "entityId");

CREATE UNIQUE INDEX "watchlist_topics_watchlistId_topicId_key" ON "watchlist_topics"("watchlistId", "topicId");

CREATE INDEX "watchlist_matches_watchlistId_seen_idx" ON "watchlist_matches"("watchlistId", "seen");
CREATE UNIQUE INDEX "watchlist_matches_watchlistId_eventId_key" ON "watchlist_matches"("watchlistId", "eventId");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

-- Evidence layer foreign keys
ALTER TABLE "evidence_snapshots" ADD CONSTRAINT "evidence_snapshots_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Event layer foreign keys
ALTER TABLE "event_status_changes" ADD CONSTRAINT "event_status_changes_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_evidence" ADD CONSTRAINT "event_evidence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_evidence" ADD CONSTRAINT "event_evidence_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "evidence_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Artifact layer foreign keys
ALTER TABLE "event_artifacts" ADD CONSTRAINT "event_artifacts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Entity layer foreign keys
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Relationship layer foreign keys
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Topic layer foreign keys
ALTER TABLE "topics" ADD CONSTRAINT "topics_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "topic_aliases" ADD CONSTRAINT "topic_aliases_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_topics" ADD CONSTRAINT "event_topics_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_topics" ADD CONSTRAINT "event_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Session layer foreign keys
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "anon_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watchlist_entities" ADD CONSTRAINT "watchlist_entities_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "watchlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "watchlist_topics" ADD CONSTRAINT "watchlist_topics_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "watchlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "watchlist_matches" ADD CONSTRAINT "watchlist_matches_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
