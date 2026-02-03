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
