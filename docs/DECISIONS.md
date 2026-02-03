# GenAI2 Decisions

This document records key technical choices for the scaffold.

## 1) Next.js App Router (target: v16)
- **Decision**: Use Next.js App Router for the primary web surface.
- **Why**: Aligns with React Server Components and modern routing conventions.
- **Notes**: Current dependency may be on the latest stable (v15.x) until v16 is released.

## 2) pnpm workspaces
- **Decision**: Standardize on pnpm with a single lockfile.
- **Why**: Fast, deterministic installs with workspace linking.

## 3) Turborepo pipeline
- **Decision**: Use Turbo for task orchestration (`build`, `lint`, `typecheck`, `test`).
- **Why**: Scales across apps/packages and keeps CI consistent.

## 4) tRPC for typed API boundaries
- **Decision**: Use tRPC for type-safe API calls between web and API.
- **Why**: Eliminates manual client typing and reduces contract drift.

## 5) Prisma for database access
- **Decision**: Use Prisma for schema management and client generation.
- **Why**: Strong DX, migrations workflow, and type safety.

## 6) Council Show: Director/Cast Architecture (Planned)
- **Decision**: Use a Director/Cast model for dynamic Daily Show episodes.
- **Why**: Enables NotebookLM-style dynamic conversations while maintaining evidence-grounding.
- **Director**: Cheap model (Gemini Flash) decides turn order, move types, stop conditions.
- **Cast**: Personas (GM, Engineer, Skeptic) generate constrained, evidence-linked content.
- **Spec**: `docs/specs/COUNCIL_SHOW.md`
- **Status**: Planned for Phase 9 (post-launch).

---

## Phase 1 Data Model Decisions (2026-02-03)

### 7) Evidence Layer: Source + Snapshot Separation
- **Decision**: Separate `EvidenceSource` (URL identity) from `EvidenceSnapshot` (point-in-time capture).
- **Why**: URLs are stable, but content changes. Multiple snapshots per source enables tracking changes over time.
- **Trust Tiers**: AUTHORITATIVE (official), STANDARD (journalism), LOW (aggregators/social).

### 8) Event State Machine: Append-Only Transitions
- **Decision**: Events progress through states: `RAW → ENRICHED → VERIFIED → PUBLISHED | QUARANTINED | BLOCKED`
- **Why**: No backward transitions. If wrong, create new event. Full audit trail via `EventStatusChange`.
- **Note**: QUARANTINED for conflicting sources or low confidence. BLOCKED for spam/duplicates.

### 9) Artifact Payloads: Typed JSON with Zod
- **Decision**: `EventArtifact.payload` is typed JSON validated by Zod schemas, not text blobs.
- **Why**: Parse once at creation, validate structure. Enables type-safe access in UI.
- **Types**: HEADLINE, SUMMARY, GM_TAKE, WHY_MATTERS, ENTITY_EXTRACT, TOPIC_ASSIGN.

### 10) LLM Observability: Every Call Logged
- **Decision**: `LLMRun` model tracks every LLM invocation with model, tokens, cost, latency, prompt hash.
- **Why**: Replay capability (regenerate any artifact), cost tracking, debugging.
- **Cost**: Stored in cents (integer) for precision.

### 11) Relationship Safety Gate: Risk-Based Validation
- **Decision**: Relationships require evidence-based validation, not model confidence.
- **Why**: Model confidence is logged but NEVER used for approval. Trust tiers and source count determine approval.
- **Rules**:
  - LOW risk (RELEASED, ANNOUNCED, PUBLISHED): Single source OK
  - MEDIUM risk (PARTNERED, INTEGRATED, FUNDED): 2+ sources OR AUTHORITATIVE
  - HIGH risk (ACQUIRED, BANNED, BEATS, CRITICIZED): MUST have AUTHORITATIVE OR 2+ sources
- **Implementation**: `packages/shared/src/graph-safety.ts` with 78 tests.

### 12) Topic Hierarchy: Parent-Child with Aliases
- **Decision**: Topics support hierarchy via `parentId` and fuzzy matching via `TopicAlias`.
- **Why**: Enables "Models > LLM" navigation and "language model" → "llm" matching.
- **Seed**: 16 topics (6 top-level, 10 subcategories) with aliases.

### 13) Session: Server-Side with HttpOnly Cookie
- **Decision**: `AnonSession` stores user state server-side with HttpOnly cookie token.
- **Why**: No localStorage for important data. Prevents XSS token theft.
- **State**: lastEventCursor for catch-up, preferences JSON, watchlist relations.

### 14) Full-Text Search: PostgreSQL tsvector + GIN
- **Decision**: FTS columns on `events` and `entities` tables using PostgreSQL native tsvector.
- **Why**: No external search service needed. GIN indexes for fast querying.
- **Weights**: 'A' for titles/names, 'B' for descriptions. English + simple (Croatian) configs.

### 15) Fingerprint Deduplication
- **Decision**: Events use `fingerprint` (SHA-256 hash of sourceType + date + normalized title) for dedup.
- **Why**: Same story from multiple sources creates single event with multiple evidence links.
- **Implementation**: `packages/db/src/backfill.ts` has `generateFingerprint()` helper.
