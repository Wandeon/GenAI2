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
| 0     | Observatory Wow Slice  | 2 weeks   | **In Progress** |
| 1     | Data Foundation        | 2 weeks   | Planned         |
| 2     | Event Pipeline         | 2 weeks   | Planned         |
| 3     | Observatory Production | 2 weeks   | Planned         |
| 4     | Daily Run              | 1.5 weeks | Planned         |
| 5     | Explore                | 2 weeks   | Planned         |
| 6     | Personalization        | 1.5 weeks | Planned         |
| 7     | Library + Migration    | 2 weeks   | Planned         |
| 8     | Polish + Launch        | 1.5 weeks | Planned         |

---

## Phase 0: Observatory Wow Slice

**Owner:** Web

**Goal:** Ship something magical that feels like the future

* [x] Next.js scaffold + Tailwind v4 + shadcn
* [x] tRPC setup + type-safe client
* [x] Layout shell (sidebar, header, context panel)
* [x] Lane component + EventCard
* [x] tRPC API route handler
* [x] Mock events with time filtering
* [x] Keyboard navigation hook (j/k/[/])
* [ ] Search bar with instant results
* [ ] Connect to existing APIs (HN, GitHub, Papers)
* [ ] Time Machine wired to tRPC filter
* [ ] Context panel showing selected event
* [ ] Mobile layout (tabs, swipe)

**Gate:**

* Observatory renders real data
* Time Machine interactive
* Tested on desktop + 375px mobile
* Stakeholder demo produces "holy crap" reaction

---

## Phase 1: Data Foundation

**Owner:** API / Worker

**Goal:** Build the evidence + artifact system properly

* [ ] EvidenceSource + EvidenceSnapshot models
* [ ] Event model with fingerprint dedup
* [ ] EventStatusChange audit log
* [ ] EventArtifact with typed payloads
* [ ] LLMRun observability model
* [ ] Topic model + EventTopic join + seed
* [ ] Entity model + EntityAlias + EntityMention
* [ ] Relationship model + Safety Gate
* [ ] FTS columns + GIN indexes
* [ ] AnonSession + Watchlist models
* [ ] Backfill script

**Gate:**

* All migrations applied on staging
* All tests passing
* Backfill produces valid Events

---

## Phase 2: Event Pipeline

**Owner:** Worker

**Goal:** Events flow automatically with GM processing

* [ ] evidence-snapshot processor
* [ ] event-create processor
* [ ] event-enrich processor
* [ ] entity-extract processor
* [ ] relationship-extract + safety gate
* [ ] topic-assign processor
* [ ] watchlist-match processor
* [ ] Queue orchestration

**Gate:**

* New HN post → Event with artifacts in < 2 minutes

---

## Phase 3: Observatory Production

**Owner:** Web / API

* [ ] tRPC router for events
* [ ] Replace mock data
* [ ] SSE signal + REST fetch
* [ ] Time Machine real data
* [ ] Lane config persisted
* [ ] GM Transparency panel
* [ ] Quarantine lane
* [ ] Virtualization

**Gate:**

* Lighthouse Performance ≥ 85
* Lighthouse Accessibility ≥ 90
* Mobile verified

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
