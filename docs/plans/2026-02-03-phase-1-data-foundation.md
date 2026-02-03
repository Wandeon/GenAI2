# Phase 1: Data Foundation Implementation Plan

> **STATUS: ✅ COMPLETE** (2026-02-03)
>
> All tasks implemented and deployed to v2.genai.hr staging.
> - 20 new database models
> - 12 new enums
> - 2 migrations (schema + FTS)
> - 78 graph-safety tests
> - Topic seed script with 16 topics
> - Backfill script scaffold

**Goal:** Build the evidence + artifact system with proper data models, creating the foundation for the event pipeline and observatory production features.

**Architecture:** Prisma schema with append-only state machine for events, evidence snapshots for provenance, typed artifact payloads validated by Zod, and safety gates for relationship validation.

**Tech Stack:** Prisma, PostgreSQL, Zod, TypeScript

---

## Phase 1 Overview

| Sprint | Focus | Tasks |
|--------|-------|-------|
| 1.1 | Evidence Layer | EvidenceSource, EvidenceSnapshot, TrustTier |
| 1.2 | Event Layer | Event, EventStatusChange, EventEvidence |
| 1.3 | Artifact & LLM | EventArtifact, LLMRun observability |
| 1.4 | Entity Layer | Entity, EntityAlias, EntityMention |
| 1.5 | Relationship + Safety | Relationship model, safety gate validation |
| 1.6 | Topic Layer | Topic hierarchy, EventTopic, seed data |
| 1.7 | Session & Watchlist | AnonSession, Watchlist, matches |
| 1.8 | FTS + Backfill | Search vectors, GIN indexes, backfill script |

---

## Sprint 1.1: Evidence Layer

**Goal:** Create models for tracking source URLs and point-in-time content snapshots.

### Task 1: Add Evidence enums and EvidenceSource model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

Add after the datasource block:

```prisma
// ============================================================================
// ENUMS
// ============================================================================

enum TrustTier {
  AUTHORITATIVE  // Official announcements, press releases
  STANDARD       // Quality journalism, established sources
  LOW            // Aggregators, social media, user-generated
}

enum SourceType {
  HN
  GITHUB
  ARXIV
  NEWSAPI
  REDDIT
  LEADERBOARD
  HUGGINGFACE
  PRODUCTHUNT
  DEVTO
  YOUTUBE
  LOBSTERS
}

// ============================================================================
// EVIDENCE LAYER - Immutable record of what we retrieved
// ============================================================================

model EvidenceSource {
  id           String    @id @default(cuid())
  rawUrl       String
  canonicalUrl String    @unique
  domain       String
  trustTier    TrustTier @default(STANDARD)

  snapshots    EvidenceSnapshot[]

  createdAt    DateTime  @default(now())

  @@index([canonicalUrl])
  @@index([domain])
  @@map("evidence_sources")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add EvidenceSource model and TrustTier enum`

---

### Task 2: Add EvidenceSnapshot model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

Add after EvidenceSource:

```prisma
model EvidenceSnapshot {
  id          String   @id @default(cuid())
  sourceId    String

  // What we saw at this moment
  title       String?
  author      String?
  publishedAt DateTime?
  retrievedAt DateTime @default(now())

  // Content fingerprint
  contentHash String   // SHA-256 of fullText
  fullText    String?  @db.Text

  // HTTP metadata
  httpStatus  Int?
  headers     Json?

  source      EvidenceSource @relation(fields: [sourceId], references: [id])
  eventLinks  EventEvidence[]

  @@index([sourceId])
  @@index([contentHash])
  @@index([retrievedAt])
  @@map("evidence_snapshots")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add EvidenceSnapshot model for point-in-time captures`

---

### Task 3: Create and apply migration

**Files:**
- Create: `packages/db/prisma/migrations/[timestamp]_evidence_layer/migration.sql` (auto-generated)

**Steps:**
```bash
cd packages/db
pnpm prisma migrate dev --name evidence_layer
```

**Verification:**
- Migration file created
- Database schema updated
- `pnpm db:generate` succeeds

**Commit:** `chore(db): add evidence_layer migration`

---

## Sprint 1.2: Event Layer

**Goal:** Create the core Event model with append-only state machine and evidence linking.

### Task 4: Add Event enums

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

Add to enums section:

```prisma
enum EventStatus {
  RAW           // Just created from source
  ENRICHED      // GM processed (has artifacts)
  VERIFIED      // Relationships validated
  PUBLISHED     // Visible in Observatory
  QUARANTINED   // Flagged for review
  BLOCKED       // Rejected (spam, duplicate, irrelevant)
}

enum ImpactLevel {
  BREAKING      // Major announcement, funding, launch
  HIGH          // Significant development
  MEDIUM        // Notable but not urgent
  LOW           // Background noise, minor update
}

enum EvidenceRole {
  PRIMARY       // Main source for this event
  SUPPORTING    // Additional confirmation
  CONTEXT       // Background information
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add Event status and impact enums`

---

### Task 5: Update Event model with full schema

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

Replace the placeholder Event model:

```prisma
model Event {
  id          String      @id @default(cuid())
  fingerprint String      @unique

  // Core event data
  occurredAt  DateTime
  title       String
  titleHr     String?

  // Classification
  impactLevel ImpactLevel @default(MEDIUM)
  importance  Float       @default(0)

  // Append-only state machine
  status        EventStatus @default(RAW)
  statusHistory EventStatusChange[]

  // Relations
  evidence    EventEvidence[]
  topics      EventTopic[]
  mentions    EntityMention[]
  artifacts   EventArtifact[]

  // Traceability
  sourceType  SourceType
  sourceId    String
  ingestRunId String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([occurredAt])
  @@index([importance])
  @@index([impactLevel])
  @@index([status])
  @@index([fingerprint])
  @@map("events")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): expand Event model with full schema`

---

### Task 6: Add EventStatusChange audit log

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model EventStatusChange {
  id         String       @id @default(cuid())
  eventId    String
  fromStatus EventStatus?
  toStatus   EventStatus
  reason     String
  changedAt  DateTime     @default(now())
  changedBy  String?

  event      Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId])
  @@map("event_status_changes")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add EventStatusChange audit log`

---

### Task 7: Add EventEvidence join model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model EventEvidence {
  id         String       @id @default(cuid())
  eventId    String
  snapshotId String
  role       EvidenceRole @default(PRIMARY)

  event      Event            @relation(fields: [eventId], references: [id], onDelete: Cascade)
  snapshot   EvidenceSnapshot @relation(fields: [snapshotId], references: [id])

  @@unique([eventId, snapshotId])
  @@map("event_evidence")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add EventEvidence join model`

---

### Task 8: Create event layer migration

**Steps:**
```bash
cd packages/db
pnpm prisma migrate dev --name event_layer
```

**Verification:**
- Migration file created
- `pnpm db:generate` succeeds
- `pnpm typecheck` succeeds

**Commit:** `chore(db): add event_layer migration`

---

## Sprint 1.3: Artifact & LLM Layer

**Goal:** Create models for GM outputs with versioning and LLM cost tracking.

### Task 9: Add ArtifactType enum

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
enum ArtifactType {
  HEADLINE       // { en: string, hr: string }
  SUMMARY        // { en: string, hr: string, bulletPoints: string[] }
  GM_TAKE        // { take: string, takeHr: string, confidence: string }
  WHY_MATTERS    // { text: string, textHr: string, audience: string[] }
  ENTITY_EXTRACT // { entities: Array<{name, type, role, confidence}> }
  TOPIC_ASSIGN   // { topics: Array<{slug, confidence}> }
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add ArtifactType enum`

---

### Task 10: Add EventArtifact model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model EventArtifact {
  id            String       @id @default(cuid())
  eventId       String
  artifactType  ArtifactType
  version       Int          @default(1)

  // Structured payload (validated by Zod at runtime)
  payload       Json

  // Provenance
  modelUsed     String
  promptVersion String
  promptHash    String
  inputHash     String
  runId         String

  createdAt     DateTime     @default(now())

  event         Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([eventId, artifactType, version])
  @@index([eventId])
  @@index([runId])
  @@map("event_artifacts")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add EventArtifact model with typed payloads`

---

### Task 11: Add LLMRun observability model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model LLMRun {
  id            String   @id @default(cuid())

  // What was called
  provider      String
  model         String

  // Usage
  inputTokens   Int
  outputTokens  Int
  totalTokens   Int

  // Cost (in USD cents)
  costCents     Int

  // Timing
  latencyMs     Int

  // Replay capability
  promptHash    String
  inputHash     String

  // Context
  processorName String
  eventId       String?

  createdAt     DateTime @default(now())

  @@index([createdAt])
  @@index([eventId])
  @@index([processorName])
  @@map("llm_runs")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add LLMRun observability model`

---

### Task 12: Create artifact layer migration

**Steps:**
```bash
cd packages/db
pnpm prisma migrate dev --name artifact_layer
```

**Verification:**
- Migration created
- `pnpm db:generate` succeeds

**Commit:** `chore(db): add artifact_layer migration`

---

## Sprint 1.4: Entity Layer

**Goal:** Create models for tracking companies, models, people, and their mentions in events.

### Task 13: Add EntityType and MentionRole enums

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
enum EntityType {
  COMPANY
  LAB
  MODEL
  PRODUCT
  PERSON
  REGULATION
  DATASET
  BENCHMARK
}

enum MentionRole {
  SUBJECT     // Primary actor
  OBJECT      // Thing being acted upon
  MENTIONED   // Referenced but not central
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add EntityType and MentionRole enums`

---

### Task 14: Update Entity model with full schema

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

Replace the placeholder Entity model:

```prisma
model Entity {
  id            String       @id @default(cuid())

  name          String
  nameHr        String?
  slug          String       @unique
  type          EntityType

  description   String?      @db.Text
  descriptionHr String?      @db.Text

  aliases       EntityAlias[]
  importance    Float        @default(0)

  firstSeen     DateTime     @default(now())
  lastSeen      DateTime     @default(now())

  mentions      EntityMention[]
  sourceRels    Relationship[] @relation("source")
  targetRels    Relationship[] @relation("target")

  @@unique([name, type])
  @@index([type])
  @@index([importance])
  @@index([slug])
  @@map("entities")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): expand Entity model with full schema`

---

### Task 15: Add EntityAlias model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model EntityAlias {
  id       String @id @default(cuid())
  entityId String
  alias    String

  entity   Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([entityId, alias])
  @@index([alias])
  @@map("entity_aliases")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add EntityAlias model`

---

### Task 16: Add EntityMention model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model EntityMention {
  id         String      @id @default(cuid())
  eventId    String
  entityId   String
  role       MentionRole @default(MENTIONED)
  confidence Float       @default(1.0)

  event      Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  entity     Entity      @relation(fields: [entityId], references: [id])

  @@unique([eventId, entityId])
  @@map("entity_mentions")
}
```

**Verification:**
```bash
pnpm db:generate
pnpm typecheck
```

**Commit:** `feat(db): add EntityMention model`

---

### Task 17: Create entity layer migration

**Steps:**
```bash
cd packages/db
pnpm prisma migrate dev --name entity_layer
```

**Commit:** `chore(db): add entity_layer migration`

---

## Sprint 1.5: Relationship Layer + Safety Gate

**Goal:** Create the relationship model with safety gate validation logic.

### Task 18: Add Relationship enums

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
enum RelationshipStatus {
  PENDING       // Awaiting validation
  APPROVED      // Passed safety gate
  QUARANTINED   // Needs human review
  REJECTED      // Failed safety gate
}

enum RelationType {
  // Low risk - single source OK
  RELEASED
  ANNOUNCED
  PUBLISHED

  // Medium risk - prefer 2+ sources
  PARTNERED
  INTEGRATED
  FUNDED

  // High risk - require authoritative OR 2+ sources
  ACQUIRED
  BANNED
  BEATS
  CRITICIZED
}
```

**Commit:** `feat(db): add RelationshipStatus and RelationType enums`

---

### Task 19: Add Relationship model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model Relationship {
  id              String             @id @default(cuid())

  sourceId        String
  targetId        String
  type            RelationType

  eventId         String

  status          RelationshipStatus @default(PENDING)
  statusReason    String?
  modelConfidence Float?

  occurredAt      DateTime
  createdAt       DateTime           @default(now())
  validatedAt     DateTime?

  source          Entity             @relation("source", fields: [sourceId], references: [id])
  target          Entity             @relation("target", fields: [targetId], references: [id])

  @@index([sourceId])
  @@index([targetId])
  @@index([type])
  @@index([status])
  @@map("relationships")
}
```

**Commit:** `feat(db): add Relationship model with safety gate fields`

---

### Task 20: Add safety gate validation utility

**Files:**
- Create: `packages/shared/src/graph-safety.ts`

**Implementation:**

```typescript
import type { RelationType, RelationshipStatus, TrustTier } from "@genai/db";

const RISK_LEVELS: Record<RelationType, "LOW" | "MEDIUM" | "HIGH"> = {
  RELEASED: "LOW",
  ANNOUNCED: "LOW",
  PUBLISHED: "LOW",
  PARTNERED: "MEDIUM",
  INTEGRATED: "MEDIUM",
  FUNDED: "MEDIUM",
  ACQUIRED: "HIGH",
  BANNED: "HIGH",
  BEATS: "HIGH",
  CRITICIZED: "HIGH",
};

interface SafetyResult {
  status: RelationshipStatus;
  reason: string;
}

export function validateRelationship(
  type: RelationType,
  trustTier: TrustTier,
  sourceCount: number
): SafetyResult {
  const risk = RISK_LEVELS[type];

  if (risk === "LOW") {
    return { status: "APPROVED", reason: "Low-risk with evidence" };
  }

  if (risk === "MEDIUM") {
    if (trustTier === "AUTHORITATIVE") {
      return { status: "APPROVED", reason: "Authoritative source" };
    }
    if (sourceCount >= 2) {
      return { status: "APPROVED", reason: "Multiple sources confirm" };
    }
    return {
      status: "QUARANTINED",
      reason: "Medium-risk needs 2+ sources or authoritative",
    };
  }

  // HIGH risk
  if (trustTier === "AUTHORITATIVE") {
    return { status: "APPROVED", reason: "Authoritative source for high-risk" };
  }
  if (sourceCount >= 2) {
    return { status: "APPROVED", reason: "Multiple sources confirm high-risk" };
  }
  return {
    status: "QUARANTINED",
    reason: "High-risk requires authoritative source or 2+ sources",
  };
}
```

**Commit:** `feat(shared): add relationship safety gate validation`

---

### Task 21: Create relationship layer migration

**Steps:**
```bash
cd packages/db
pnpm prisma migrate dev --name relationship_layer
```

**Commit:** `chore(db): add relationship_layer migration`

---

## Sprint 1.6: Topic Layer

**Goal:** Create hierarchical topic taxonomy with event associations and seed data.

### Task 22: Add TopicOrigin enum

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
enum TopicOrigin {
  MANUAL   // Human assigned
  LLM      // Model assigned
  RULE     // Rule-based
}
```

**Commit:** `feat(db): add TopicOrigin enum`

---

### Task 23: Update Topic model with hierarchy

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

Replace placeholder Topic:

```prisma
model Topic {
  id          String       @id @default(cuid())

  name        String       @unique
  nameHr      String
  slug        String       @unique
  description String?

  // Hierarchy
  parentId    String?
  parent      Topic?       @relation("hierarchy", fields: [parentId], references: [id])
  children    Topic[]      @relation("hierarchy")

  // Display
  color       String?
  icon        String?
  sortOrder   Int          @default(0)

  events      EventTopic[]
  aliases     TopicAlias[]

  @@map("topics")
}
```

**Commit:** `feat(db): expand Topic model with hierarchy`

---

### Task 24: Add TopicAlias and EventTopic models

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model TopicAlias {
  id      String @id @default(cuid())
  topicId String
  alias   String

  topic   Topic  @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@unique([alias])
  @@map("topic_aliases")
}

model EventTopic {
  id         String      @id @default(cuid())
  eventId    String
  topicId    String
  confidence Float       @default(1.0)
  origin     TopicOrigin @default(LLM)

  event      Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  topic      Topic       @relation(fields: [topicId], references: [id])

  @@unique([eventId, topicId])
  @@map("event_topics")
}
```

**Commit:** `feat(db): add TopicAlias and EventTopic models`

---

### Task 25: Create topic seed script

**Files:**
- Create: `packages/db/prisma/seed.ts`

**Implementation:**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const topics = [
  { name: "LLMs", nameHr: "Veliki jezicni modeli", slug: "llms", icon: "🤖", sortOrder: 1 },
  { name: "Computer Vision", nameHr: "Racunalni vid", slug: "computer-vision", icon: "👁️", sortOrder: 2 },
  { name: "Robotics", nameHr: "Robotika", slug: "robotics", icon: "🦾", sortOrder: 3 },
  { name: "AI Safety", nameHr: "Sigurnost AI-a", slug: "ai-safety", icon: "🛡️", sortOrder: 4 },
  { name: "Research", nameHr: "Istrazivanje", slug: "research", icon: "🔬", sortOrder: 5 },
  { name: "Industry", nameHr: "Industrija", slug: "industry", icon: "🏭", sortOrder: 6 },
  { name: "Regulation", nameHr: "Regulativa", slug: "regulation", icon: "⚖️", sortOrder: 7 },
  { name: "Open Source", nameHr: "Otvoreni kod", slug: "open-source", icon: "📂", sortOrder: 8 },
  { name: "Agents", nameHr: "Agenti", slug: "agents", icon: "🕵️", sortOrder: 9 },
  { name: "Benchmarks", nameHr: "Mjerila", slug: "benchmarks", icon: "📊", sortOrder: 10 },
];

async function main() {
  console.log("Seeding topics...");

  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: topic,
      create: topic,
    });
  }

  console.log(`Seeded ${topics.length} topics`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Add to package.json:**
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

**Commit:** `feat(db): add topic seed script`

---

### Task 26: Create topic layer migration and seed

**Steps:**
```bash
cd packages/db
pnpm prisma migrate dev --name topic_layer
pnpm prisma db seed
```

**Commit:** `chore(db): add topic_layer migration and seed data`

---

## Sprint 1.7: Session & Watchlist Layer

**Goal:** Create server-side session and watchlist models for personalization.

### Task 27: Update AnonSession model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

Replace placeholder:

```prisma
model AnonSession {
  id              String   @id @default(cuid())
  token           String   @unique @default(cuid())

  lastSeenAt      DateTime @default(now())
  lastEventCursor String?
  preferences     Json     @default("{}")

  watchlists      Watchlist[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([token])
  @@map("anon_sessions")
}
```

**Commit:** `feat(db): expand AnonSession with preferences and cursor`

---

### Task 28: Add Watchlist model

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Implementation:**

```prisma
model Watchlist {
  id             String            @id @default(cuid())
  sessionId      String
  name           String

  entities       WatchlistEntity[]
  topics         WatchlistTopic[]
  keywords       String[]

  lastNotifiedAt DateTime?

  session        AnonSession       @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  matches        WatchlistMatch[]

  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@map("watchlists")
}

model WatchlistEntity {
  id          String @id @default(cuid())
  watchlistId String
  entityId    String

  @@unique([watchlistId, entityId])
  @@map("watchlist_entities")
}

model WatchlistTopic {
  id          String @id @default(cuid())
  watchlistId String
  topicId     String

  @@unique([watchlistId, topicId])
  @@map("watchlist_topics")
}

model WatchlistMatch {
  id          String    @id @default(cuid())
  watchlistId String
  eventId     String
  matchedAt   DateTime  @default(now())
  seen        Boolean   @default(false)

  watchlist   Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)

  @@unique([watchlistId, eventId])
  @@index([watchlistId, seen])
  @@map("watchlist_matches")
}
```

**Commit:** `feat(db): add Watchlist and related models`

---

### Task 29: Create session layer migration

**Steps:**
```bash
cd packages/db
pnpm prisma migrate dev --name session_layer
```

**Commit:** `chore(db): add session_layer migration`

---

## Sprint 1.8: FTS + Backfill

**Goal:** Add full-text search capabilities and create backfill script for existing data.

### Task 30: Add FTS columns via raw SQL migration

**Files:**
- Create: `packages/db/prisma/migrations/[timestamp]_add_fts/migration.sql`

**Implementation:**

Create manual migration:
```bash
cd packages/db
pnpm prisma migrate dev --name add_fts --create-only
```

Then edit the migration file:

```sql
-- Add search_vector column to events
ALTER TABLE events ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(title_hr, '')), 'A')
  ) STORED;

-- Add search_vector column to entities
ALTER TABLE entities ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name_hr, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

-- Create GIN indexes for fast full-text search
CREATE INDEX events_search_idx ON events USING GIN(search_vector);
CREATE INDEX entities_search_idx ON entities USING GIN(search_vector);
```

**Apply:**
```bash
pnpm prisma migrate deploy
```

**Commit:** `feat(db): add full-text search columns and GIN indexes`

---

### Task 31: Create backfill script for existing feed data

**Files:**
- Create: `packages/db/scripts/backfill-events.ts`

**Implementation:**

```typescript
/**
 * Backfill script to migrate existing feed data to Event model
 *
 * Usage: pnpm --filter @genai/db run backfill
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function generateFingerprint(title: string, date: Date): string {
  const normalized = title.toLowerCase().trim();
  const dateStr = date.toISOString().split("T")[0];
  return crypto.createHash("sha256").update(`${normalized}:${dateStr}`).digest("hex").slice(0, 16);
}

async function main() {
  console.log("Starting backfill...");

  // This is a placeholder - actual implementation depends on
  // how feed data is currently stored

  console.log("Backfill complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Add to package.json:**
```json
"scripts": {
  "backfill": "tsx scripts/backfill-events.ts"
}
```

**Commit:** `feat(db): add event backfill script scaffold`

---

### Task 32: Final verification and documentation

**Steps:**

1. Run full migration on fresh database:
```bash
cd packages/db
pnpm prisma migrate reset --force
pnpm prisma db seed
```

2. Verify all models:
```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

3. Update ROADMAP.md to mark Phase 1 complete

**Commit:** `docs: mark Phase 1 Data Foundation complete`

---

## Phase 1 Exit Gate

- [ ] All migrations applied successfully
- [ ] Prisma client generates without errors
- [ ] Typecheck passes
- [ ] Build passes
- [ ] Seed script creates topic data
- [ ] Backfill script structure ready

---

## Files Summary

### To Create
- `packages/db/prisma/migrations/*` (auto-generated)
- `packages/db/prisma/seed.ts`
- `packages/db/scripts/backfill-events.ts`
- `packages/shared/src/graph-safety.ts`

### To Modify
- `packages/db/prisma/schema.prisma` (major expansion)
- `packages/db/package.json` (add seed config)
- `docs/ROADMAP.md` (mark complete)

---

## Technical Notes

### Migration Strategy
- Use `prisma migrate dev` for development
- Use `prisma migrate deploy` for staging/production
- Never use `prisma db push` in production

### Prisma Limitations
- tsvector columns added via raw SQL
- Generated columns require Prisma 5.x+
- JSON fields validated at runtime with Zod

### Testing Strategy
- Unit tests for safety gate validation
- Integration tests with test database
- Seed script for consistent test data
