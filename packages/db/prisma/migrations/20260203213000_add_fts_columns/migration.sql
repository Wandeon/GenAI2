-- Phase 1: Add Full-Text Search (FTS) Columns
-- Adds PostgreSQL tsvector columns with GIN indexes for fast searching
--
-- This migration depends on: 20260203212722_phase1_data_foundation
--
-- Features:
-- - Generated tsvector columns that auto-update when source columns change
-- - Weighted search: 'A' for titles/names (most important), 'B' for descriptions
-- - Dual language support: 'english' for English, 'simple' for Croatian (no stemming)
-- - GIN indexes for fast full-text search queries

-- ============================================================================
-- EVENTS TABLE FTS
-- ============================================================================

-- Add FTS column to events table
-- Combines English title (weight A) and Croatian title (weight A)
ALTER TABLE "events" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("titleHr", '')), 'A')
  ) STORED;

-- Create GIN index for fast full-text search on events
CREATE INDEX "events_search_idx" ON "events" USING GIN("search_vector");

-- ============================================================================
-- ENTITIES TABLE FTS
-- ============================================================================

-- Add FTS column to entities table
-- Combines:
-- - English name (weight A - most important)
-- - English description (weight B - secondary)
-- - Croatian name (weight A - most important)
-- - Croatian description (weight B - secondary)
ALTER TABLE "entities" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("nameHr", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("descriptionHr", '')), 'B')
  ) STORED;

-- Create GIN index for fast full-text search on entities
CREATE INDEX "entities_search_idx" ON "entities" USING GIN("search_vector");
