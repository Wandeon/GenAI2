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
