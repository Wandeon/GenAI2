# GenAI2 Architecture

## Architecture constitution (summary)

- **Evidence-first**: ingest raw evidence before interpretation; keep provenance and source metadata.
- **Append-only artifacts**: new insights are appended; no silent mutation of historical artifacts.
- **Event-driven pipelines**: new evidence emits events; processors react asynchronously.
- **Explainability > cleverness**: every derived artifact links back to sources.
- **Small, composable services**: apps consume shared packages; packages never depend on apps.

## Dependency boundaries

- `apps/*` may depend on `packages/*`.
- `packages/*` **must not** depend on `apps/*`.
- Shared configs live at the repo root and are extended by each workspace.

## Data flow (conceptual)

```
Evidence ingest
    |
    v
Evidence snapshots  --->  Enrichment processors  --->  Events
    |                                          |           |
    |                                          v           v
    |------------------------------------->  Entities    Relationships
                                                    |
                                                    v
                                                 Artifacts
```

Notes:
- Evidence snapshots are immutable.
- Events are the canonical timeline.
- Artifacts are curated outputs (briefs, summaries, watchlist updates).
