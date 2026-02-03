# Roadmap

GenAI Observatory implementation roadmap following the "Wow Slice First" approach.

## Philosophy

Ship the cockpit first. The "holy crap" moment happens in Week 2, not Week 10.

## Phases Overview

| Phase | Focus | Duration | Status |
|-------|-------|----------|--------|
| 0 | Observatory Wow Slice | 2 weeks | **In Progress** |
| 1 | Data Foundation | 2 weeks | Planned |
| 2 | Event Pipeline | 2 weeks | Planned |
| 3 | Observatory Production | 2 weeks | Planned |
| 4 | Daily Run | 1.5 weeks | Planned |
| 5 | Explore | 2 weeks | Planned |
| 6 | Personalization | 1.5 weeks | Planned |
| 7 | Library + Migration | 2 weeks | Planned |
| 8 | Polish + Launch | 1.5 weeks | Planned |

---

## Phase 0: Observatory Wow Slice

**Goal:** Ship something magical that feels like the future

- [x] Next.js scaffold + Tailwind v4 + shadcn
- [x] tRPC setup + type-safe client
- [x] Layout shell (sidebar, header, context panel)
- [x] Lane component + EventCard
- [ ] Search bar with instant results
- [ ] Connect to existing APIs (HN, GitHub, Papers)
- [ ] Time Machine scrubber (flagship UX)
- [ ] Context panel + keyboard nav (j/k/[/])
- [ ] Mobile layout (tabs, swipe)

**Gate:** Demo to stakeholder, get "holy crap" reaction

---

## Phase 1: Data Foundation

**Goal:** Build the evidence + artifact system properly

- [ ] EvidenceSource + EvidenceSnapshot models
- [ ] Event model with fingerprint dedup
- [ ] EventStatusChange audit log
- [ ] EventArtifact with typed payloads
- [ ] LLMRun observability model
- [ ] Topic model + EventTopic join + seed
- [ ] Entity model + EntityAlias + EntityMention
- [ ] Relationship model + Safety Gate
- [ ] FTS columns + GIN indexes (raw SQL migration)
- [ ] AnonSession + Watchlist models
- [ ] Backfill script (existing data → Event)

**Gate:** All tests pass, migrations deployed to staging

---

## Phase 2: Event Pipeline

**Goal:** Events flow automatically with GM processing

- [ ] evidence-snapshot processor
- [ ] event-create processor with fingerprint
- [ ] event-enrich processor (GM artifacts)
- [ ] entity-extract processor
- [ ] relationship-extract + safety gate
- [ ] topic-assign processor
- [ ] watchlist-match processor
- [ ] Queue orchestration

**Gate:** New HN post → Event with artifacts (< 2 minutes)

---

## Phase 3: Observatory Production

**Goal:** Observatory is production-ready with tRPC

- [ ] tRPC router for events
- [ ] Replace mock data with tRPC
- [ ] SSE signal + REST fetch (CDN-safe)
- [ ] Time Machine with real data
- [ ] Lane configuration (persist server-side)
- [ ] GM Transparency panel
- [ ] Quarantine lane (admin view)
- [ ] Performance (virtualization)

**Gate:** Lighthouse > 85, mobile works

---

## Phase 4: Daily Run

**Goal:** Ritual daily briefing that creates habit

- [ ] DailyBriefing model + processor
- [ ] Daily Run page
- [ ] "GM • 12 izvora" disclosure
- [ ] "Catch up" integration via Time Machine
- [ ] Session lastEventCursor tracking

**Gate:** Return after 3 days → accurate catch-up

---

## Phase 5: Explore

**Goal:** Entity dossier first, graph optional

- [ ] Entity search (fuzzy + aliases)
- [ ] Entity dossier page
- [ ] "Recent events" for entity
- [ ] "Related entities" list
- [ ] Graph view (optional tab)
- [ ] Graph filters
- [ ] Mobile dossier

**Gate:** Search → dossier → events flow

---

## Phase 6: Personalization

**Goal:** Watchlists that drive return visits

- [ ] Session middleware (HttpOnly cookie)
- [ ] Watchlist tRPC CRUD
- [ ] Watchlist page
- [ ] "Missed events" badge
- [ ] Watchlist → Time Machine integration

**Gate:** Create watchlist → match → notification

---

## Phase 7: Library + Migration

**Goal:** WordPress content migrated with SEO preserved

- [ ] Article model
- [ ] Library page + detail
- [ ] WP crawl script
- [ ] Redirect map + automated tests
- [ ] Content migration
- [ ] SEO: sitemap, canonicals, JSON-LD
- [ ] RSS feed preservation

**Gate:** All 301s work, RSS preserved

---

## Phase 8: Polish + Launch

**Goal:** Production-ready, DNS cutover

- [ ] Performance audit (Lighthouse 90+)
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Security (CSP, rate limiting)
- [ ] LLM cost dashboard
- [ ] Staging regression
- [ ] DNS cutover
- [ ] 7-day monitoring

**Gate:** 7 days stable, SEO traffic maintained

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
