---
type: Workflow
title: Database Management
description: Session, Armory, and per-game SQLite paths — db:init, schemas, and sync prerequisites.
tags: [sqlite, database, db-init]
timestamp: 2026-07-18T20:40:00Z
---

# Database Management

Codex isolates state across several SQLite files. Game schemas ship inside workspace packages; `pnpm run db:init` applies them from built `dist` modules. Warframe catalog rows are synced from Armory’s catalog DB — see [games and collections](../domain/games-and-collections.md).

## Database map

| Env                | Absolute?             | Owns                                      | Schema / open                                |
| ------------------ | --------------------- | ----------------------------------------- | -------------------------------------------- |
| `SESSION_DB_PATH`  | **Required absolute** | Sessions, CSRF, Warframe sync runs/leases | `@codex/core` + `server/db/sessionSchema.ts` |
| `ARMORY_DB_PATH`   | **Required absolute** | Read-only Armory catalog                  | Owned by Armory                              |
| `WARFRAME_DB_PATH` | Relative OK           | Warframe worksheets/catalog               | `packages/games/warframe/src/db/schema.ts`   |
| `EPIC7_DB_PATH`    | Relative OK           | Epic7 base + accounts                     | `packages/games/epic7/src/db/schema.ts`      |
| `WOR_DB_PATH`      | Relative OK           | WoR catalog + accounts                    | `packages/games/wor/src/db/schema.ts`        |

Optional: `WOR_IMAGES_DIR` for WoR portraits (default under `./data/`).

## db:init

`scripts/db-init.mjs`:

1. Loads env candidates (including CI template).
2. Resolves game DB paths (defaults `./data/*.db`).
3. Requires built package schema modules under `packages/*/dist`.
4. Applies Warframe, Epic7, and WoR ensure/create schema helpers.

Server boot (`server/index.ts`) asserts required tables already exist — it does not replace `db:init`.

## Armory sync prerequisite

Warframe admin sync opens `ARMORY_DB_PATH` with `better-sqlite3` **readonly** (`server/services/warframeSync.ts`). Build/start Armory and import its catalog before expecting sync to succeed.

## What to watch out for

- Never use relative `../Armory/...` casually in production — mount explicit absolute paths.
- Missing package `dist` → `db:init` exits with a build hint.
- Do not write to Armory’s DB from Codex.

## Related

- [Monorepo structure](../architecture/monorepo-structure.md)
- [Environment configuration](../operations/environment-configuration.md)
- [Development workflow](development-workflow.md)
- [WoR catalog import](wor-import.md)
- [Warframe advanced progress](../domain/warframe-advanced-progress.md)
