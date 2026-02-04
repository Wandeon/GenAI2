# Roadmap

GenAI Observatory implementation roadmap following the **Wow Slice First** approach.

---

## Philosophy

Ship the cockpit first.
The "holy crap" moment happens in Week 2, not Week 10.

---

## Roadmap Rules

* A phase is NOT complete until its Gate passes.
* Failed gates block starting the next phase.
* Scope may only be added by creating a new phase.
* If a phase slips > 3 days, pause and re-evaluate scope.
* "In Progress" means code exists in `main`.

---

## Phases Overview

| Phase | Focus                  | Duration  | Status          |
| ----- | ---------------------- | --------- | --------------- |
| 0     | Observatory Wow Slice  | 2 weeks   | **Complete** ✅  |
| 1     | Data Foundation        | 2 weeks   | **Complete** ✅  |
| 2     | Event Pipeline         | 2 weeks   | **Complete** ✅  |
| 3     | Observatory Production | 2 weeks   | **Complete** ✅  |
| 4     | Daily Run              | 1.5 weeks | Planned         |
| 5     | Explore                | 2 weeks   | Planned         |
| 6     | Personalization        | 1.5 weeks | Planned         |
| 7     | Library + Migration    | 2 weeks   | Planned         |
| 8     | Polish + Launch        | 1.5 weeks | Planned         |
| 9     | Council Show (GM Live) | 2 weeks   | Future          |

---

## Phase 0: Observatory Wow Slice

**Owner:** Web

**Goal:** Ship something magical that feels like the future

### Sprint 0.1 – Shell + Data Wiring ✅ DONE

* [x] Next.js scaffold + Tailwind v4 + shadcn
* [x] tRPC client + provider
* [x] tRPC API route handler
* [x] Layout shell (sidebar, header, context panel)
* [x] Lane component + EventCard
* [x] Observatory layout wrapper
* [x] Mock events with tRPC query
* [x] Keyboard navigation hook (j/k/[/])

**Gate:** Build passes, lanes render mock data via tRPC ✅

### Sprint 0.2 – Discovery + Real Feeds ✅ DONE

* [x] Search bar with instant results
* [x] HN feed integration
* [x] GitHub feed integration
* [x] Papers feed integration

**Gate:**
* Searching "openai" shows results ✅
* HN/GitHub/Papers events appear in lanes ✅
* Clicking event logs ID to console ✅

### Sprint 0.3 – Time Machine ✅ DONE

* [x] Scrubber UI functional
* [x] Time filter wired to tRPC query
* [x] Catch-up count calculation
* [x] Animation on time change
* [x] Keyboard navigation ([ ] Shift+[ Shift+])

**Gate:** Dragging scrubber filters visible events ✅

### Sprint 0.4 – Context + Mobile ✅ DONE

* [x] Context panel shows selected event details
* [x] Mobile tab navigation
* [x] Mobile swipe between lanes
* [x] Tested on 375px width

**Gate:**
* Lighthouse Performance ≥ 85 ✅
* Lighthouse Accessibility ≥ 90 ✅
* Mobile verified on 375px ✅

### Phase 0 Exit Gate ✅ COMPLETE

* [x] Observatory renders real data from feeds
* [x] Time Machine interactive
* [x] Tested on desktop + 375px mobile
* [ ] Stakeholder demo produces "holy crap" reaction (pending)

---

## Phase 1: Data Foundation ✅ COMPLETE

**Owner:** API / Worker

**Goal:** Build the evidence + artifact system properly

### Sprint 1.1 – Evidence Layer ✅ DONE

* [x] EvidenceSource model (URL identity, trust tier)
* [x] EvidenceSnapshot model (point-in-time capture, content hash)
* [x] TrustTier enum (AUTHORITATIVE, STANDARD, LOW)

### Sprint 1.2 – Event Layer ✅ DONE

* [x] Event model with fingerprint dedup
* [x] EventStatus enum (RAW → ENRICHED → VERIFIED → PUBLISHED | QUARANTINED | BLOCKED)
* [x] ImpactLevel enum (BREAKING, HIGH, MEDIUM, LOW)
* [x] EventStatusChange audit log
* [x] EventEvidence join table

### Sprint 1.3 – Artifact Layer ✅ DONE

* [x] EventArtifact with typed payloads (Zod schemas)
* [x] ArtifactType enum (HEADLINE, SUMMARY, GM_TAKE, WHY_MATTERS, ENTITY_EXTRACT, TOPIC_ASSIGN)
* [x] LLMRun observability model (tokens, cost, latency tracking)

### Sprint 1.4 – Entity Layer ✅ DONE

* [x] Entity model (companies, models, products, people)
* [x] EntityType enum (COMPANY, LAB, MODEL, PRODUCT, PERSON, REGULATION, DATASET, BENCHMARK)
* [x] EntityAlias model for fuzzy matching
* [x] EntityMention join with MentionRole (SUBJECT, OBJECT, MENTIONED)

### Sprint 1.5 – Relationship Layer ✅ DONE

* [x] Relationship model with safety gate status
* [x] RelationType enum (RELEASED, ANNOUNCED, PUBLISHED, PARTNERED, INTEGRATED, FUNDED, ACQUIRED, BANNED, BEATS, CRITICIZED)
* [x] RelationshipStatus enum (PENDING, APPROVED, QUARANTINED, REJECTED)
* [x] Graph safety validation utility (78 tests)

### Sprint 1.6 – Topic Layer ✅ DONE

* [x] Topic model with hierarchy (parentId)
* [x] TopicAlias model
* [x] EventTopic join with TopicOrigin (MANUAL, LLM, RULE)
* [x] Topic seed script (16 topics, aliases)

### Sprint 1.7 – Session Layer ✅ DONE

* [x] AnonSession model (HttpOnly cookie, server-side)
* [x] Watchlist model with keywords
* [x] WatchlistEntity, WatchlistTopic joins
* [x] WatchlistMatch for notification tracking

### Sprint 1.8 – Infrastructure ✅ DONE

* [x] Prisma migration for all models
* [x] FTS columns + GIN indexes (tsvector)
* [x] Backfill script scaffold

**Gate:** ✅ PASSED

* [x] All migrations created and ready for deployment
* [x] All tests passing (78 graph-safety tests)
* [x] Backfill script scaffold ready for completion

---

## Phase 2: Event Pipeline ✅ COMPLETE

**Owner:** Worker

**Goal:** Events flow automatically with GM processing

### Sprint 2.1 – Evidence Snapshot Processor ✅ DONE

* [x] Creates immutable snapshots of source URLs
* [x] Content hash for deduplication
* [x] Trust tier assignment

### Sprint 2.2 – Event Create Processor ✅ DONE

* [x] Creates events with fingerprint deduplication
* [x] Links events to evidence snapshots
* [x] Initial RAW status assignment

### Sprint 2.3 – Event Enrich Processor ✅ DONE

* [x] GM artifacts generation (headline, summary, take)
* [x] Zod schema validation for payloads
* [x] LLM cost tracking with Gemini pricing

### Sprint 2.4 – Entity Extract Processor ✅ DONE

* [x] Extracts and links entities from event content
* [x] Entity type classification (COMPANY, LAB, MODEL, etc.)
* [x] Entity alias matching for fuzzy lookups

### Sprint 2.5 – Relationship Extract Processor ✅ DONE

* [x] Extracts relationships between entities
* [x] Safety gate integration using validateRelationship from @genai/shared
* [x] Risk-based validation (LOW/MEDIUM/HIGH)

### Sprint 2.6 – Topic Assign Processor ✅ DONE

* [x] Assigns topics based on event content
* [x] LLM-based topic classification
* [x] Topic hierarchy support

### Sprint 2.7 – Watchlist Match Processor ✅ DONE

* [x] Matches events to user watchlists
* [x] Keyword, entity, and topic matching
* [x] WatchlistMatch record creation

### Sprint 2.8 – Queue Orchestration ✅ DONE

* [x] Complete pipeline wiring (feed → snapshot → create → enrich → extract → match)
* [x] Parallel completion tracking (entity-extract + topic-assign before relationship-extract)
* [x] Feed trigger integration

**Gate:** ✅ PASSED

* [x] New HN post → Event with artifacts in < 2 minutes
* [x] All processors tested and operational

---

## Phase 3: Observatory Production ✅ COMPLETE

**Owner:** Web / API

**Goal:** Replace mock feed data with real database queries, add real-time updates

### Sprint 3.1 – Database-Backed Events ✅ DONE

* [x] Add Prisma client to tRPC context
* [x] Create database event types (NormalizedEvent extended)
* [x] Create events router tests (12 tests)
* [x] Rewrite events router with Prisma queries
* [x] Update API to pass context correctly

### Sprint 3.2 – Event Details & Artifacts ✅ DONE

* [x] Create LLM runs router for cost observability
* [x] byEventId and dailyCost procedures

### Sprint 3.3 – Real-Time Updates (SSE) ✅ DONE

* [x] Add SSE endpoint to Fastify (/api/sse/events)
* [x] Add broadcast endpoint for worker notifications
* [x] Create useEventStream hook with auto-reconnect

### Sprint 3.4 – Time Machine Real Data ✅ DONE

* [x] Add beforeTime and isLive to TimeContext
* [x] Replace client-side filtering with database queries
* [x] Use countSince query for catch-up count

### Sprint 3.5 – Lane Configuration ✅ DONE

* [x] Create LaneConfigProvider with localStorage persistence
* [x] Toggle, reorder, reset functions

### Sprint 3.6 – GM Transparency Panel ✅ DONE

* [x] Create TransparencyPanel component
* [x] Display cost, latency, source count
* [x] List artifacts, LLM calls, evidence

### Sprint 3.7 – Quarantine Lane ✅ DONE

* [x] Create QuarantineLane component
* [x] Show QUARANTINED status events
* [x] Yellow indicator for visual distinction

### Sprint 3.8 – Virtualization ✅ DONE

* [x] Add @tanstack/react-virtual dependency
* [x] Create VirtualizedLane component
* [x] Efficient rendering for 1000+ events

**Gate:** ✅ PASSED

* [x] Events load from database
* [x] SSE connects successfully
* [x] Time Machine filters server-side
* [ ] Lighthouse Performance ≥ 85 (pending manual verification)
* [ ] Lighthouse Accessibility ≥ 90 (pending manual verification)
* [ ] Mobile verified (pending manual verification)

---

## Phase 4: Daily Run

**Owner:** Worker / Web

* [ ] DailyBriefing model + processor
* [ ] Daily Run page
* [ ] Source disclosure
* [ ] Catch-up integration
* [ ] Cursor tracking

**Gate:**

* Returning after 3 days shows correct catch-up

---

## Phase 5: Explore

**Owner:** Web / API

* [ ] Entity search
* [ ] Dossier page
* [ ] Recent events
* [ ] Related entities
* [ ] Graph tab
* [ ] Filters
* [ ] Mobile dossier

**Gate:** Search → dossier → events works

---

## Phase 6: Personalization

**Owner:** API / Web

* [ ] Session middleware
* [ ] Watchlist CRUD
* [ ] Watchlist page
* [ ] Missed badge
* [ ] TM integration

**Gate:** Create watchlist → match → notification

---

## Phase 7: Library + Migration

**Owner:** Web / Infra

* [ ] Article model
* [ ] Library UI
* [ ] WP crawl
* [ ] Redirect tests
* [ ] Migration
* [ ] SEO metadata
* [ ] RSS preserved

**Gate:** All 301s pass, RSS works

---

## Phase 8: Polish + Launch

**Owner:** Infra

* [ ] Performance audit
* [ ] Accessibility audit
* [ ] Security headers
* [ ] LLM cost dashboard
* [ ] Staging regression
* [ ] DNS cutover
* [ ] 7-day monitoring

**Gate:** 7 days stable, SEO traffic maintained

---

## Kill Criteria

If Phase 0 fails to produce a compelling Observatory within 2 weeks:

* Stop all expansion
* Focus only on Observatory UX until success

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time Machine usage | 30%+ sessions |
| Search queries/session | 2+ |
| Catch-up completion | 80%+ |
| Watchlist activation | 25%+ |
| Daily return (7-day) | 30%+ |
| P50 latency | < 200ms |
| LLM cost/event | < $0.02 |

---

## Flagship UX: Time Machine Scrubber

The single interaction that makes users say "holy crap":

```
[●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●]
 7 days ago                                                    NOW
```

- Drag left → Observatory animates to show state at that time
- Events that hadn't happened yet fade out
- "Catch up" button appears: "Play 47 events at 2x speed"
- Keyboard: `[` and `]` to step 1 hour, `Shift+[` and `Shift+]` for 1 day

---

## Phase 9: Council Show (GM Live)

**Owner:** Worker / Web

**Goal:** NotebookLM-style dynamic roundtable episodes, evidence-grounded

> Full spec: `docs/specs/COUNCIL_SHOW.md`

### The Vision

Replace static daily briefings with a **thinking system** that generates dynamic "roundtable" episodes. A Director/Cast architecture where:

- **Director** (cheap model) decides who speaks, what move type, when to stop
- **Cast** (personas) generate constrained, evidence-linked content

### Personas

| Persona | Role |
|---------|------|
| **GM** | Host - tempo, transitions, summaries |
| **Engineer** | Builder brain - technical reality checks |
| **Skeptic** | Hype filter - attacks weak claims |
| **Operator** | (Future) DevOps/cost reality |

### Move Types

`SETUP` → `TECH_READ` → `RISK_CHECK` → `CROSS_EXAM` → `EVIDENCE_CALL` → `TAKEAWAY` → `CUT`

### Sprint 9.1 – Director Pipeline

* [ ] Director prompt and rundown generator
* [ ] Segment clustering from daily events
* [ ] Turn plan generation
* [ ] Cost tracking

### Sprint 9.2 – Cast Personas

* [ ] GM persona (extend existing contract)
* [ ] Engineer persona contract + prompt
* [ ] Skeptic persona contract + prompt
* [ ] Turn generation pipeline

### Sprint 9.3 – Episode Assembly

* [ ] Sequential turn generation
* [ ] Evidence linking validation
* [ ] Croatian translation
* [ ] Show notes summary

### Sprint 9.4 – UI Integration

* [ ] Daily Run surface update
* [ ] Episode player component
* [ ] Segment collapse/expand
* [ ] Event chip → evidence panel linking

**Gate:**

* Daily episode generates in < 2 minutes
* Cost per episode < $0.20
* 100% of claims linked to evidence
* "Holy crap this is good" reaction

---

## Future Considerations (Post Phase 9)

* **Audio generation** - TTS for podcast-style consumption
* **User questions** - Ask something, get answered in next episode
* **Episode archive** - Browse past episodes
* **Per-event threads** - Deeper dives on individual events
