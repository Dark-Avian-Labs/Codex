---
type: Domain Concept
title: Games and Collections
description: Warframe worksheets, Epic Seven curated catalogs, and Watcher of Realms import-backed collections.
tags: [warframe, epic7, wor, collection]
timestamp: 2026-07-18T20:40:00Z
---

# Games and Collections

Codex tracks three games registered in `server/games/metadataRegistry.ts` (`warframe`, `epic7`, `wor`). Each game has a package schema, server routes, and client features. Persistence layout: [database management](../workflows/database-management.md). Admin gates: [authentication](../workflows/authentication.md).

## Warframe

| Layer   | Path                                              |
| ------- | ------------------------------------------------- |
| Package | `packages/games/warframe/`                        |
| API     | `server/routes/warframeApi.ts`                    |
| Sync    | `server/services/warframeSync.ts` (+ job helpers) |
| UI      | `client/features/warframe/`                       |

Model: worksheets with columns/rows/`cell_values`, user settings, `catalog_rows` master data, and advanced progress tables. Admin sync copies catalog (and related) data from Armory’s `ARMORY_DB_PATH` into Codex’s Warframe DB. Deep dive: [Warframe advanced progress](warframe-advanced-progress.md). Client worksheet UX: [client UI](../architecture/client-ui.md).

## Epic Seven

| Layer   | Path                        |
| ------- | --------------------------- |
| Package | `packages/games/epic7/`     |
| API     | `server/routes/epic7Api.ts` |
| UI      | `client/features/epic7/`    |

Model: `base_heroes` / `base_artifacts` curated by admins; `game_accounts` with `account_heroes` / `account_artifacts` seeded from base. **No live Epic Seven game API.**

## Watcher of Realms

| Layer   | Path                                           |
| ------- | ---------------------------------------------- |
| Package | `packages/games/wor/`                          |
| API     | `server/routes/worApi.ts`, `worAdminApi.ts`    |
| Import  | `server/import/wor/`, `scripts/wor-import.mjs` |
| UI      | `client/features/wor/`                         |

Model: catalog tables for heroes/artifacts/demons plus account copies. Catalog can bootstrap on startup when empty and via admin/CLI import (Fastidious + Fandom images). Deep dive: [WoR catalog import](../workflows/wor-import.md).

## What to watch out for

- Warframe UX is worksheet-oriented; Epic7/WoR are account + catalog oriented — do not force one UI pattern onto another.
- Sync and WoR import are admin operations with leases/jobs — avoid concurrent conflicting runs.
- README may omit WoR; trust `CODEX_GAMES` / metadata registry.

## Related

- [Database management](../workflows/database-management.md)
- [Monorepo structure](../architecture/monorepo-structure.md)
- [Client UI architecture](../architecture/client-ui.md)
- [Warframe advanced progress](warframe-advanced-progress.md)
- [WoR catalog import](../workflows/wor-import.md)
- [Authentication](../workflows/authentication.md)
