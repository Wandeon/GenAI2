# GenAI2 Architecture

## Architecture Constitution

These principles are **binding**.
If code contradicts them, the code is wrong.

1. **Evidence-First**

   * All derived knowledge must originate from an Evidence Snapshot.
   * No artifact may exist without at least one linked evidence record.
   * Evidence snapshots are immutable.

2. **Append-Only Artifacts**

   * Artifacts are never edited in place.
   * New understanding produces a new artifact version.
   * Historical artifacts remain accessible.

3. **Event-Driven Pipelines**

   * New evidence emits an internal event.
   * Processors subscribe and react asynchronously.
   * No processor directly calls another processor.

4. **Events as Canonical Timeline**

   * Events represent what happened in the world.
   * Artifacts represent interpretations of events.
   * UI renders from Events + Artifacts, never raw sources.

5. **Explainability Over Cleverness**

   * Every artifact must link back to its evidence.
   * "Why this exists" must be answerable for every record.

6. **Small, Composable Services**

   * Apps consume shared packages.
   * Packages never depend on apps.
   * Cyclic dependencies are forbidden.

7. **Deterministic Boundaries**

   * Parsing, validation, enrichment, and storage are separate steps.
   * Each step has a single responsibility.

---

## Dependency Boundaries

Allowed:

```
apps/*  --->  packages/*
packages/*  --->  packages/*
```

Forbidden:

```
packages/*  -X->  apps/*
apps/*      -X->  other apps/*
```

Rules:

* Shared logic lives in `packages/`.
* Applications contain only orchestration, routing, and UI.
* Cross-package imports must use public entry points.

---

## Conceptual Data Flow

```
Raw Source
   |
   v
Evidence Snapshot (immutable)
   |
   v
Event (what happened)
   |
   +------------------+
   |                  |
   v                  v
Entities         Relationships
   |                  |
   +--------+---------+
            |
            v
        Artifacts
   (GM takes, summaries,
    topics, briefs, etc.)
```

---

## Layer Semantics

### Evidence Snapshot

* Immutable capture of retrieved content.
* Stores raw text, metadata, hashes.

### Event

* Canonical representation of a real-world occurrence.
* Deduplicated.
* Has timestamp and evidence links.

### Entity

* Stable identifier for real-world objects (company, model, person, regulation, etc.).

### Relationship

* Edge between two entities.
* Must reference an Event.
* May be pending, approved, quarantined, or rejected.

### Artifact

* Derived interpretation.
* Always versioned.
* Always traceable to Event + Evidence.

---

## Invariants

* No artifact without event.
* No event without evidence.
* No relationship without event.
* No mutation of historical records.
* No hidden side effects.

Violations must fail CI.

---

## Non-Goals

* Building a generic CMS.
* Replacing source websites.
* Real-time chat or social feed features.
* Opinionated political commentary.

GenAI2 is an **observatory**, not a publisher.
