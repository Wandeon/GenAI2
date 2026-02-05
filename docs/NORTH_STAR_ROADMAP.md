# North Star Roadmap

A sprinted, documentation-backed roadmap to evolve GenAI Observatory from the current system into the north-star “situational awareness console” described in `docs/SYSTEM_CHEATSHEET.md`.

---

## How to Read This

- **Sprint length:** 2 weeks.
- **Definition of done:** Each sprint closes only when its **Gate** passes.
- **Backing documentation:** Every sprint produces a minimum set of docs or updates to existing docs so work is traceable.
- **No scope creep:** Add scope only by adding a new sprint.

---

## Current State Snapshot (Starting Line)

The system already ships core evidence/event/artifact primitives, LLM observability, topic/entity/relationship layers, and a functioning Observatory UI with time-machine and daily run flows. This roadmap focuses on evolving those capabilities into a reliable, evidence-backed world model with a control-room UX and multi-agent synthesis.

---

# Roadmap Overview

| Sprint | Theme | Goal | Gate |
| --- | --- | --- | --- |
| 0 | North Star Alignment | Lock the model, language, and taxonomy | North-star docs approved + source taxonomy v1 | 
| 1 | Originals-First Ingest | Replace “NewsAPI-first” bias with direct sources | 70%+ events from original sources | 
| 2 | Event Clustering & Dedup | Many URLs → one Event | 95% of clustered duplicates merged | 
| 3 | Evidence Sets & Confidence | Claims require multi-source corroboration | Confidence labels visible + enforced | 
| 4 | Structured Knowledge Artifacts | Typed outputs as primary interface | All artifacts validated & queryable | 
| 5 | World Model Graph | Entities/Topics/Relations first-class | Graph explorer + relationship confidence | 
| 6 | Memory & Trend Engine | Yesterday vs today and trend arcs | Daily diffs + trend dashboards | 
| 7 | Multi-Agent Deliberation | Multiple perspectives per important topic | Multi-voice artifacts shipped | 
| 8 | Control Room UX | Observatory → operations console | Time Machine + Dossiers + Daily Run integrated |
| 9 | Reliability & Traceability | Replayable, auditable runs | End-to-end provenance on all artifacts |

---

# Sprint 0 — North Star Alignment (2 weeks)

**Goal:** Lock the vocabulary, decision rules, and source taxonomy so execution is consistent.

**Scope**
- Confirm the “We Are NOT” vs “We MUST” system constraints and make them canonical.
- Create a source taxonomy with trust tiers and example URLs.
- Align UI terminology to “Events, Evidence, Artifacts.”

**Deliverables**
- `docs/SYSTEM_CHEATSHEET.md` (north-star compression doc).
- `docs/specs/source-taxonomy.md` (source classes, examples, trust tier rules).
- `docs/DECISIONS.md` entry: “Originals-first ingest & evidence thresholds.”

**Gate**
- Cheat sheet approved by leadership.
- Source taxonomy v1 published and used in ingest configs.

**Backing Documentation**
- `docs/SYSTEM_CHEATSHEET.md`
- `docs/specs/source-taxonomy.md`
- `docs/DECISIONS.md`

---

# Sprint 1 — Originals-First Ingest (2 weeks)

**Goal:** Prioritize first-party sources over aggregated coverage.

**Scope**
- Implement direct crawlers for vendor blogs, changelogs, docs, release notes, GitHub, and research labs.
- Annotate EvidenceSource with origin type (FIRST_PARTY, JOURNALISM, AGGREGATOR).
- Use trust tiers to boost authoritative sources.

**Deliverables**
- Crawler coverage for top 50 target domains by signal density.
- EvidenceSource origin type + trust tier migrations.
- Dashboard: “Originals ratio by day.”

**Gate**
- 70%+ of events sourced from FIRST_PARTY or AUTHORITATIVE sources.

**Backing Documentation**
- `docs/specs/ingest-crawlers.md`
- `docs/DECISIONS.md` entry: “Originals-first ranking.”
- `docs/ARCHITECTURE.md` update for crawler pipeline.

---

# Sprint 2 — Event Clustering & Dedup (2 weeks)

**Goal:** Many URLs → one Event.

**Scope**
- Enhance fingerprinting with embedding similarity + rule-based heuristics.
- Build cluster review tooling for manual merges.
- Add event “cluster summary” artifact.

**Deliverables**
- Automatic clustering pipeline with evidence set aggregation.
- Event merge workflow with audit trail.
- Cluster summary artifact schema.

**Gate**
- 95% of duplicate stories merged into a single Event within 24 hours.

**Backing Documentation**
- `docs/specs/event-clustering.md`
- `docs/DECISIONS.md` entry: “Cluster merge thresholds.”

---

# Sprint 3 — Evidence Sets & Confidence (2 weeks)

**Goal:** Claims require corroboration and confidence is visible.

**Scope**
- Introduce EvidenceSet model (claim → sources).
- Confidence rubric: corroboration count + source tier + recency.
- Enforce publish gate requiring 2+ corroborating sources or 1 authoritative.

**Deliverables**
- EvidenceSet + confidence scoring implementation.
- UI labels: “Low / Medium / High confidence.”
- Quarantine workflow for single-source claims.

**Gate**
- 100% of published events have evidence sets + confidence label.

**Backing Documentation**
- `docs/specs/evidence-confidence.md`
- `docs/DECISIONS.md` entry: “Publish gate thresholds.”

---

# Sprint 4 — Structured Knowledge Artifacts (2 weeks)

**Goal:** Typed outputs are the primary interface.

**Scope**
- Expand artifact schema coverage (diffs, impact, stakeholders, timeline nodes).
- Enforce schema validation on all outputs.
- Build artifact query layer for UI and API.

**Deliverables**
- New artifact types: `EVENT_DIFF`, `IMPACT`, `STAKEHOLDERS`, `TIMELINE_NODE`.
- Schema registry with versioning.
- Artifact query endpoints.

**Gate**
- 100% artifacts validated, and UI uses typed payloads only.

**Backing Documentation**
- `docs/specs/artifacts-registry.md`
- `docs/DECISIONS.md` entry: “Artifact schema versioning.”
- `packages/shared/src/schemas` updates.

---

# Sprint 5 — World Model Graph (2 weeks)

**Goal:** Events connected to entities, topics, relationships, and timelines.

**Scope**
- Add relationship confidence + evidence linking.
- Build graph query endpoints and “Explore Dossiers.”
- Highlight recurring entities and relationship history.

**Deliverables**
- Graph API (entity → events, topics, relationships, timelines).
- Relationship evidence linkage and confidence scoring.
- Explore Dossier UI.

**Gate**
- 80% of events link to entities + topics + at least one relationship.

**Backing Documentation**
- `docs/specs/world-model-graph.md`
- `docs/ARCHITECTURE.md` graph query update.

---

# Sprint 6 — Memory & Trend Engine (2 weeks)

**Goal:** The system remembers what humans forget.

**Scope**
- Daily diff engine (yesterday vs today).
- Trend tracking for topics and entities.
- Recurring entity memory and “watchlist relevance score.”

**Deliverables**
- Trend models and persistence jobs.
- Daily diff artifact in the Daily Run.
- Watchlist “what changed” notifications.

**Gate**
- Daily diff is stable and featured in the Daily Run.

**Backing Documentation**
- `docs/specs/trends-diffs.md`
- `docs/DECISIONS.md` entry: “Trend scoring methodology.”

---

# Sprint 7 — Multi-Agent Deliberation (2 weeks)

**Goal:** Important topics deserve multiple viewpoints.

**Scope**
- Add multi-agent perspectives (e.g., “Builder,” “Investor,” “Safety”).
- Store structured discussion artifacts with prompts and role metadata.
- UI to display perspectives + points of agreement/disagreement.

**Deliverables**
- New artifact: `PERSPECTIVE_SET` with per-role payloads.
- Deliberation pipeline and safety guardrails.
- UI card showing perspective summary + disagreement flags.

**Gate**
- 90% of high-impact events include multi-agent perspectives.

**Backing Documentation**
- `docs/specs/multi-agent.md`
- `docs/DECISIONS.md` entry: “Perspective roles + escalation.”

---

# Sprint 8 — Control Room UX (2 weeks)

**Goal:** Observatory becomes a situational awareness console.

**Scope**
- Integrate Daily Run, Observatory, Time Machine, and Explore Dossiers.
- Control-room layout (operators, timelines, evidence panel).
- “What changed / Why it matters / Who should care” triad enforced in UI.

**Deliverables**
- Unified navigation and control-room layout.
- Evidence panel showing all sources + confidence.
- Dossier-first navigation for entities/topics.

**Gate**
- Internal users complete daily workflow without leaving control-room UI.

**Backing Documentation**
- `docs/specs/control-room-ui.md`
- `docs/DECISIONS.md` entry: “UI north-star constraints.”

---

# Sprint 9 — Reliability & Traceability (2 weeks)

**Goal:** Every artifact is replayable and auditable.

**Scope**
- Add run replay tooling with promptHash/inputHash.
- Capture provenance edges for all outputs.
- Integrate failure alerts and circuit breakers.

**Deliverables**
- Replay UI + API (re-run with stored inputs).
- Provenance graph for artifacts.
- Reliability dashboard (cost, latency, failures).

**Gate**
- 100% artifacts show provenance and can be replayed end-to-end.

**Backing Documentation**
- `docs/specs/provenance-replay.md`
- `docs/DECISIONS.md` entry: “Replay + retention policy.”

---

# Cross-Cutting Quality Gates (All Sprints)

- **Evidence coverage:** No published event without evidence set + confidence.
- **Structured outputs:** All artifacts validated against schemas.
- **Traceability:** Every artifact links to evidence + LLM run.
- **Cost controls:** Remain under $0.02 per event unless approved.
- **Ops health:** Daily run completes under 30 minutes.

---

# Roadmap Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Source drift or crawler breakage | Health checks + alerting per crawler | 
| Duplicate event inflation | Tighten clustering thresholds + manual merge tools | 
| Evidence shortages | Trust-tier weighting + source expansion | 
| UI overload | Progressive disclosure + dossier-centric UX | 
| Cost spikes | Circuit breakers + model fallback policies | 

---

# Success Metrics

- **Originals ratio:** ≥ 70% of events from first-party sources.
- **Confidence coverage:** 100% of events labeled.
- **Return rate:** Users feel missing a day is risky.
- **Replay rate:** 100% artifacts replayable within 30 days.
- **Operator flow:** Time-to-daily-brief < 10 minutes.
