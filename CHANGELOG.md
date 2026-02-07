# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Phase 5: Explore (2026-02-06)
- Entity dossier pages at `/explore/[slug]` with bilingual support and aliases
- Fuzzy entity search with alias matching, debounce, type filter pills, keyboard nav
- Events timeline per entity with role filter (SUBJECT, OBJECT, MENTIONED) and infinite scroll
- Related entities sidebar with connection counts and relationship type tags
- Relationship timeline with Croatian verb mappings (NADMASUJE, OBJAVIO, PREUZEO, etc.)
- Mention velocity sparklines (7-day trend with color-coded stroke)
- Recent searches stored in session preferences (max 8, deduped by slug)
- Dynamic popular entities via `topByMentions` query
- Entity type visual config (`type-config.ts`) — shared icons, colors, badge classes
- tRPC routers: `entities.bySlug`, `fuzzySearch`, `topByMentions`, `related`, `graphData`, `mentionVelocity`
- tRPC routers: `sessions.addRecentSearch`, `sessions.getRecentSearches`
- 18 entity query tests, 15 session tests (59 total tRPC tests)

### Added — UI Redesign (2026-02-05)
- Light warm-mono palette replacing dark glassmorphism (white, stone, amber accents)
- Geist Sans + Geist Mono typography
- Bottom tab bar (mobile, 3 tabs: Dnevni/Uzivo/Dossier) + icon rail (desktop, 56px/200px)
- `UnifiedEventCard` component with evidence expander and impact dots
- `CompactEventRow` — Reddit/HN-style dense row for mobile feeds
- `CouncilHero` — roundtable teaser with preview turns
- `StreakBadge` — localStorage-based daily visit streak counter
- Mobile/desktop split: `DailyMobile` (dense feed) + `DailyDesktop` (spacious cockpit)
- Source filter bar on Intel (/live) page
- `todayOrLatest` briefing fallback — mobile never shows blank state
- Relaxed publish gate (REQUIRED_ARTIFACTS: HEADLINE only)

### Added — Phase 4: Daily Run (2026-02-04)
- `DailyBriefing` + `DailyBriefingItem` schema (date-unique, ranked events)
- `DailyBriefingPayload` Zod schema (bilingual: en/hr)
- Daily briefing processor with LLM ranking (22 tests)
- tRPC routers: `dailyBriefings.today`, `byDate`, `list`, `byIdWithEvents`, `todayOrLatest` (12 tests)
- Session middleware with HttpOnly cookies (Architecture Constitution #5)
- Sessions router: `get`, `updateCursor`, `getCatchUp`, `updatePreferences`, `markSeen` (15 tests)
- Daily Run page with ranked cards + roundtable teaser
- Catch-up integration: "Play 47 events at 2x speed"
- Croatian localization (Sto se promijenilo, GM Prognoza)

### Added — Phase 3: Observatory Production (2026-02-03)
- Prisma client integration in tRPC context
- 14 database event query tests
- SSE real-time updates (`/api/sse/events`)
- Time Machine with server-side filtering
- Lane configuration with localStorage persistence
- GM transparency panel (cost/latency/sources)
- Quarantine lane for safety-gated events
- Virtualized rendering for 1000+ events (@tanstack/react-virtual)

### Added — Phase 2: Event Pipeline (2026-02-03)
- 8 processors: snapshot, create, enrich, entity-extract, relationship-extract, topic-assign, watchlist-match, confidence-score
- Evidence snapshot processor (content hash dedup)
- Event enrichment via GM (headline, summary, take artifacts)
- Entity extraction with fuzzy matching
- Relationship safety gates (risk-based validation, 78 tests)
- Topic assignment with hierarchy support
- LLM cost tracking with Gemini pricing

### Added — Phase 1: Data Foundation (2026-02-03)
- EvidenceSource + EvidenceSnapshot models (trust tiers: AUTHORITATIVE, STANDARD, LOW)
- Event model with fingerprint dedup and state machine (RAW → PUBLISHED | QUARANTINED)
- EventArtifact with typed JSON payloads (Zod schemas)
- Entity model (COMPANY, LAB, MODEL, PRODUCT, PERSON, REGULATION, DATASET, BENCHMARK)
- EntityAlias for fuzzy matching, EntityMention with roles
- Relationship model with safety gate status
- Topic model with hierarchy and aliases (16 seed topics)
- AnonSession with HttpOnly cookie, Watchlist, WatchlistMatch
- FTS columns + GIN indexes (tsvector)

### Added — Phase 0: Observatory Wow Slice (2026-02-03)
- Next.js 16 scaffold with Tailwind v4 + shadcn/ui
- tRPC client/server wiring
- Lane-based event feed with 3 sources (HN, GitHub, arXiv)
- Time Machine scrubber (interactive time slider, keyboard nav)
- Context panel for event details
- Mobile tab navigation with swipe between lanes
- Tested on 375px width

### Infrastructure
- Turborepo for monorepo task orchestration
- pnpm 9.x for package management
- TypeScript 5.9 strict mode
- Prisma 6.x for database
- Tailwind CSS v4 with PostCSS
- GitHub Actions CI (build, typecheck, lint) + Deploy (Docker → GHCR → SSH to VPS-00)
- Caddy reverse proxy (v2.genai.hr → web:3000, api:4000)
- Deploy SSH timeout: 20 minutes (for large Docker images)

## [0.0.0] - 2026-02-03

- Repository created
