---
type: Workflow
title: WoR Catalog Import
description: Fastidious catalog fetch, Fandom/Fastidious images, validation, and account sync for Watcher of Realms.
tags: [wor, import, fastidious, fandom]
timestamp: 2026-07-18T21:05:00Z
---

# WoR Catalog Import

Watcher of Realms has no live game API. Codex builds catalog tables via a pipeline that fetches Fastidious data, optionally downloads portraits, applies overrides, validates, upserts SQLite, then syncs account rows. Domain overview: [games and collections](../domain/games-and-collections.md). Paths: [database management](database-management.md) (`WOR_DB_PATH`, `WOR_IMAGES_DIR`). Admin gate: [authentication](authentication.md).

## Where to start

| Concern            | Path                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| Step keys + labels | `server/import/wor/worPipelineSteps.ts`                               |
| Orchestrator       | `server/import/wor/startupPipeline.ts`                                |
| Fastidious         | `server/import/wor/fastidiousCatalog.ts`, `fastidiousClient.ts`       |
| Images             | `server/import/wor/fandomImages.ts`, `images.ts`                      |
| Validate / upsert  | `validateCatalog.ts`, `catalogQueries.ts`                             |
| Admin job / API    | `server/import/wor/adminImportJob.ts`, `server/routes/worAdminApi.ts` |
| CLI                | `scripts/wor-import.mjs` (`pnpm run wor:import`)                      |
| Live/offline paths | `server/import/wor/paths.ts`                                          |
| Shared keys only   | `shared/worPipelineSteps.ts` (keep in sync with server labels)        |

## Steps

1. `schema` — ensure tables
2. `fastidiousCatalog` — fetch/normalize catalog bundle
3. `fandomImages` — wiki portraits (needs `WIKI_USER_AGENT`; else Fastidious card images)
4. `manualOverrides` — apply `scripts/data/wor-overrides.json` (patch existing slugs; **add** rows whose slug is absent from Fastidious when required identity fields are set)
5. `seedValidation` — validate before write
6. `sync_accounts` — refresh account rows from catalog

In the orchestrator, overrides are applied before portrait download so wiki-only additions (e.g. heroes missing from Fastidious) still get Fandom images.

Options: `forceImport`, `forceImages`, `forceSteps[]`, fixture path, log callback.

## Entry points

| Trigger      | Behavior                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Server boot  | If `catalogNeedsImport` (empty catalog), run `runWorStartupPipeline()` — failures log, do not crash process |
| Admin UI/API | Status + SSE stream; single-flight (rejects if import already running)                                      |
| CLI          | Built `dist` required; `--force` / `--force-images`; live mode via `WOR_IMPORT_LIVE` unless offline/test    |

Offline/fixture: when live import is disabled, use cache under `scripts/data/wor-import-cache` or `scripts/data/wor-catalog-fixture.json`.

## Manual overrides (`scripts/data/wor-overrides.json`)

| Mode  | When                               | Required fields                                                                  |
| ----- | ---------------------------------- | -------------------------------------------------------------------------------- |
| Patch | Slug already in Fastidious catalog | Any subset of catalog columns                                                    |
| Add   | Slug missing from Fastidious       | Heroes: `name`, `class`, `faction`, `rarity`. Artifacts/demons: `name`, `rarity` |

Use adds for wiki-only entities Fastidious has not shipped yet. Re-run admin/CLI import after editing the file (`pnpm run wor:import` or Admin → WoR import). When Fastidious later includes the same slug, the entry becomes a normal patch merge.

## What to watch out for

- Build server before CLI import.
- Duplicate step definitions (`shared/` vs `server/import/wor/`) — labels live on the server copy.
- Concurrent admin imports are rejected.
- Image dir defaults under `./data/`; Fandom API needs a proper wiki user agent.
- Override-only adds still need a catalog re-import to land in SQLite / account rows.

## Related

- [Games and collections](../domain/games-and-collections.md)
- [Database management](database-management.md)
- [Environment configuration](../operations/environment-configuration.md)
- [Client UI](../architecture/client-ui.md) (admin tool)
