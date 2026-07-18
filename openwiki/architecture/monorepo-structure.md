---
type: Architecture Overview
title: Monorepo Structure
description: pnpm workspace packages, app shells, and how games plug into Codex.
tags: [architecture, monorepo, workspace]
timestamp: 2026-07-18T20:40:00Z
---

# Monorepo Structure

Codex is a pnpm workspace. Shared auth/session code lives in `@codex/core`; each game is an isolated package consumed by the Express server and React client. See [database management](../workflows/database-management.md) and [games domains](../domain/games-and-collections.md).

## Where to start

| Concern       | Path                                       |
| ------------- | ------------------------------------------ |
| Workspace     | `pnpm-workspace.yaml`, root `package.json` |
| Core          | `packages/core/` → `@codex/core`           |
| Games         | `packages/games/warframe                   | epic7 | wor/` |
| Server entry  | `server/index.ts`                          |
| API mount     | `server/routes/api.ts`                     |
| Client entry  | `client/main.tsx`                          |
| Game registry | `server/games/metadataRegistry.ts`         |

## Packages

| Package                | Role                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| `@codex/core`          | Clerk helpers, session SQLite, middleware, shared validation/logger |
| `@codex/game-warframe` | Warframe worksheet schema, catalog master, domain rules             |
| `@codex/game-epic7`    | Epic7 base + account schemas and validation                         |
| `@codex/game-wor`      | WoR catalog + account schemas and validation                        |

The root app owns HTTP routing (`server/routes/*`), Warframe sync services (`server/services/warframeSync*.ts`), WoR import (`server/import/wor/`), and the SPA under `client/features/`.

## What to watch out for

- Always build workspace packages before `db:init`, server `tsc`, or tests that import package `dist`.
- Add a new game by creating a package, registering it in `metadataRegistry.ts`, wiring routes, and extending `db:init`.
- Do not put game-specific SQL into `@codex/core`.

## Related

- [Client UI architecture](client-ui.md)
- [Authentication](../workflows/authentication.md)
- [Database management](../workflows/database-management.md)
- [Development workflow](../workflows/development-workflow.md)
- [Quickstart](../quickstart.md)
