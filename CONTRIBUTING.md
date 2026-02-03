# Contributing to GenAI2

This document defines **how changes are proposed, implemented, reviewed, and merged**.

If something here conflicts with `CLAUDE.md` or `DECISIONS.md`, those documents take precedence.

---

## Branching & Naming

* Create short-lived branches off `main`.
* Suggested prefixes:

  * `feat/` – new feature
  * `fix/` – bug fix
  * `chore/` – tooling, deps, cleanup
  * `docs/` – documentation only
  * `refactor/` – internal restructuring

Examples:

```
feat/observatory-lanes
fix/entity-dedup
docs/architecture-constitution
```

---

## Commit Conventions

Use concise, imperative messages:

```
feat(observatory): add lane virtualization
fix(api): validate event payload schema
docs: add LLM configuration
chore(deps): update prisma
```

Rules:

* One logical change per commit.
* Avoid mixing unrelated changes.
* No "WIP" commits on PRs.

---

## Pull Request Requirements

Every PR must include:

* Clear description of **what** and **why**
* List of files changed
* Tests added or updated
* Screenshots or clips for UI changes (if applicable)

PRs must:

* Pass CI (build, typecheck, lint, test)
* Respect Architecture Constitution
* Not reduce test coverage

---

## Adding a New App or Package

1. Create folder under `apps/` or `packages/`.
2. Add `package.json` with unique `name`.
3. Add `tsconfig.json` extending root config.
4. Add `README.md` describing purpose and boundaries.
5. Add `.env.example` if environment variables are required.
6. Register tasks in `turbo.json` if needed.

Packages must never import from `apps/*`.

---

## Database / Schema Changes

Any Prisma schema change requires:

* Migration file
* Update to `DECISIONS.md`
* Brief explanation in PR description

Breaking changes without migration are rejected.

---

## Documentation Discipline

When introducing a new concept, you must update at least one of:

* `ARCHITECTURE.md`
* `DECISIONS.md`
* `CLAUDE.md`
* `docs/`

Code and documentation must evolve together.

---

## Local Checks (Required Before PR)

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

If any check fails, fix the root cause before opening a PR.

---

## Review Philosophy

* Prefer small PRs over large ones.
* Ask questions early.
* If unsure about direction, open a draft PR with a plan.

---

## Non-Negotiables

* No secrets in code
* No schema changes without migration
* No deletion of scaffolds without explicit approval
* No placeholders or TODOs in production code
* No direct commits to `main`
