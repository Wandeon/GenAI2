# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial monorepo scaffold with Turborepo + pnpm workspaces
- **apps/web**: Next.js 16 with App Router, 5 surface pages (Observatory, Daily, Explore, Watchlists, Library)
- **apps/api**: Fastify + tRPC server with session middleware
- **apps/worker**: BullMQ processor scaffolds (evidence-snapshot, event-create, event-enrich)
- **apps/admin**: React Admin dashboard placeholder
- **packages/db**: Prisma schema with placeholder models (EvidenceSource, Event, Entity, Topic, AnonSession)
- **packages/shared**: Zod artifact schemas (Headline, Summary, GMTake, WhyMatters, EntityExtract, TopicAssign) and graph safety gate
- **packages/trpc**: tRPC routers for events, entities, topics
- **packages/ui**: Shared shadcn components (Button, Card) with Tailwind CSS v4
- **packages/llm**: GM service contract and placeholder implementation
- TimeMachine, EventCard, Lane components for Observatory
- Croatian language support (`lang="hr"`) in web layout
- GitHub Actions CI workflow (install, build, typecheck, lint)
- Documentation: ARCHITECTURE.md, CONTRIBUTING.md, DECISIONS.md, ENVIRONMENT.md
- Per-app `.env.example` files

### Infrastructure
- Turborepo for monorepo task orchestration
- pnpm 9.x for package management
- TypeScript 5.8 strict mode
- Prisma 6.x for database
- Tailwind CSS v4 with PostCSS

## [0.0.0] - 2026-02-03

- Repository created
