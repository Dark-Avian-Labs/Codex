# Codex

## Org standards

Shared Dark Avian Labs engineering conventions (README shape, CI/PR runners, validate, release tracks) live in AppBase [`docs/org-standards/`](../AppBase/docs/org-standards/). The design system (theme axes, glass contracts, UI primitives, Clerk appearance) lives in AppBase [`AGENTS.md`](../AppBase/AGENTS.md). There is no shared UI package: when you change layout, glass, buttons, modals, or dropdowns here, apply the same change in Armory.

## Overview

Codex is a table-based collection tracker for **Warframe**, **Epic Seven**, and **Watcher of Realms** (`wor`). Each game is its own workspace package under `packages/`. Do not force one UI pattern across games: Warframe is worksheets/cells; Epic Seven and WoR are account + catalog lists. There is no shared collection-table abstraction.

Warframe catalog rows sync from Armory's SQLite. Epic Seven and WoR have no live game API: Epic Seven uses curated `base_*` tables; WoR imports from Fastidious and Fandom.

Default listen port is **3001**. See `README.md` for scripts and env.

## Build and databases

Workspace packages must be built before tests, `db:init`, or a server compile. `pnpm run build` does this; `pnpm run validate` does not. Include `@codex/game-wor` with core/warframe/epic7:

```bash
pnpm --filter @codex/core --filter @codex/game-warframe --filter @codex/game-epic7 --filter @codex/game-wor run --if-present build
```

`pnpm run db:init` applies Warframe, Epic Seven, and WoR schemas from built package `dist`. Server `onOpen` assumes tables already exist (WoR `onOpen` is validate + additive migrations only). Encrypted `.env.production` garbles `VITE_BASE_PATH` during `vite build`; rebuild the client with `npx vite build --mode devbuild`.

| File           | Env                                                | Notes                                                                                                                                                    |
| -------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session        | `SESSION_DB_PATH`                                  | **Absolute.** Codex-owned. CSRF, Epic7/WoR active account, **and** Warframe sync runs/leases. Not Armory's session file.                                 |
| Armory catalog | `ARMORY_DB_PATH`                                   | **Absolute, read-only.** Opened with `busy_timeout = 5000` because Armory may write the same WAL. `ensureDataDirs()` does not create this file's parent. |
| Game DBs       | `WARFRAME_DB_PATH`, `EPIC7_DB_PATH`, `WOR_DB_PATH` | May be relative. Codex copies Armory catalog into the Warframe DB; it does not live-join Armory forever.                                                 |

Do not point session and Armory paths at the same file, and do not reuse BudgetPlanner SQLite files. Sync yields between users; force-release of the sync lease is refused while an in-process sync is still running. Sync preview is `POST /api/warframe/admin/sync-preview` (CSRF), not GET.

`/healthz` is liveness. `/readyz` checks session + game DBs + a readable `ARMORY_DB_PATH`.

## Warframe progress

Advanced progress lives in `row_advanced_progress`, not `cell_values` (`PATCH …/advanced-progress`). Auto Orokin / auto Arcane force `true` when resolving display/persist state, overwriting a stored `false` for exalted and warframe auto-arcane cases. Non-subsumable Excalibur Umbra Helminth may only be `Unavailable`.

Modular Weapons prefer Armory's `codex_modular_weapons` table. DE `codex_secret` / `exclude_from_codex` flags are stored in Armory; Codex does not filter on them.

## Watcher of Realms

Heroes have a primary `faction` plus optional `faction_secondary` (Fastidious dual-faction). Filters match either. Override patches run **before** portrait download so wiki-only (override-add) heroes still get images. Catalog upsert, deactivation, version bump, and account sync run in one transaction after downloads. Keep `shared/worPipelineSteps.ts` in sync with `server/import/wor/worPipelineSteps.ts`.

If the WoR catalog is empty at boot, the startup pipeline runs; failures log and do **not** crash the process. Admin import returns **202** and uses a lease plus in-process single-flight.

## Auth

Clerk keys are required in production (`apps.codex === 'admin'` for admin). Placeholder keys make the middleware throw 500 on every request; the server still listens. Leave keys empty in local dev if you do not have real ones. CI env template: `.github/ci.env.development`.

## Toolchain

Node **26+**, pnpm **11.x**, exact `packageManager`. Encrypted env files need `DOTENV_PRIVATE_KEY_*` or `.env.keys`. `pnpm run validate` runs runtime preflight first (`scripts/runtime-preflight.mjs`). SQLite tests use `tests/helpers/sqliteTestHarness.ts`.

On Windows, Cursor agent shells may prepend bundled Node 22. After changing Node versions, run `pnpm rebuild better-sqlite3`.
