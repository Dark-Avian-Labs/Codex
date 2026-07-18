---
type: Workflow
title: Development Workflow
description: Build order, local run modes, validate gate, and common Vite/env pitfalls.
tags: [development, build, validate]
timestamp: 2026-07-18T20:40:00Z
---

# Development Workflow

Codex development depends on workspace package builds before server compile, DB init, and many tests. Env details: [environment configuration](../operations/environment-configuration.md). Test gate: [validate and SQLite](../testing/validate-and-sqlite.md).

## Where to start

| Concern       | Path                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Full build    | `pnpm run build` (packages → typecheck → server tsc → vite)                                                                          |
| Packages only | `pnpm --filter @codex/core --filter @codex/game-warframe --filter @codex/game-epic7 --filter @codex/game-wor run --if-present build` |
| DB init       | `pnpm run db:init`                                                                                                                   |
| Validate      | `pnpm run validate` → `run-quality-checks.mjs`                                                                                       |
| Server entry  | `server/index.ts`                                                                                                                    |

## Recommended local loop

1. Install deps (`pnpm install`).
2. Configure `.env` with absolute session + Armory paths.
3. `pnpm run build`.
4. `pnpm run db:init`.
5. Start with dotenvx or `--env-file`.
6. For client path issues with encrypted production env: `npx vite build --mode devbuild`.

## What to watch out for

- `validate` alone will not build packages — missing `dist` fails imports/preflight-adjacent work.
- Armory must exist before Warframe sync testing.
- After switching Node versions, `pnpm rebuild better-sqlite3`.
- Prefer exact `packageManager` version strings (no Corepack dist-tags).

## Related

- [Monorepo structure](../architecture/monorepo-structure.md)
- [Database management](database-management.md)
- [Validate and SQLite](../testing/validate-and-sqlite.md)
- [Quickstart](../quickstart.md)
