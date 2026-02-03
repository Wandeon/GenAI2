# Contributing to GenAI2

## Branching & naming

- Use short-lived branches off `main`.
- Suggested branch prefixes: `chore/`, `docs/`, `fix/`, `feat/`.
- Keep branch names descriptive (e.g., `docs/scaffold-audit`).

## Commit conventions

- Use concise, imperative commits (e.g., `docs: add architecture overview`).
- Group related changes; avoid large mixed commits.

## Adding a new app/package

1. Create a folder under `apps/` or `packages/`.
2. Add a `package.json` with a unique `name` and minimal scripts.
3. Add a `tsconfig.json` that extends the root config.
4. If it needs env vars, add an `.env.example`.
5. Wire it into `turbo.json` by adding relevant tasks if needed.

## Local checks

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

If a check fails, fix the root cause before opening a PR.
