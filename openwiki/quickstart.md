---
type: Repository Overview
title: Codex Quickstart
description: Entrypoint for agents and humans — what Codex is, how to run it, and where to dig deeper.
tags: [quickstart, codex]
timestamp: 2026-07-18T21:05:00Z
---

# Codex Quickstart

## What it is

**Codex** is a table-based game collection tracker. Games live in workspace packages:

- **Warframe** — worksheet inventory backed by catalog sync from Armory’s SQLite
- **Epic Seven** — curated base catalog + per-account heroes/artifacts (no live Epic7 API)
- **Watcher of Realms (WoR)** — heroes/artifacts/demons with Fastidious/Fandom catalog import

Sign-in and admin roles use Clerk. Default server port is **3001**.

## Stack and layout

| Layer    | Choice                                                                        |
| -------- | ----------------------------------------------------------------------------- |
| Runtime  | Node ≥26, pnpm ≥11 (`packageManager` exact version)                           |
| Monorepo | `@codex/core`, `@codex/game-warframe`, `@codex/game-epic7`, `@codex/game-wor` |
| Server   | Express 5, better-sqlite3, TypeScript ESM                                     |
| Client   | React 19, Vite 8, Tailwind CSS 4                                              |
| Auth     | Clerk + Express session/CSRF                                                  |

```
client/                 React SPA (per-game features, admin, auth)
server/                 Express app, routes, Warframe sync, WoR import
packages/core/          Shared auth, session DB, middleware, validation
packages/games/*/       Per-game schemas, rules, validation
scripts/                db:init, runtime-preflight, wor-import
tests/                  Vitest + SQLite harness
```

## How to run

1. `pnpm install`
2. Copy `.env.example` → `.env` (or dotenvx with `DOTENV_PRIVATE_KEY_DEVELOPMENT`)
3. Set **absolute** `SESSION_DB_PATH` and `ARMORY_DB_PATH`
4. `pnpm run build` (builds workspace packages + server + client)
5. `pnpm run db:init` (Warframe, Epic7, WoR schemas — requires built packages)
6. Ensure Armory catalog DB exists/populated before Warframe sync
7. `pnpm start`

Encrypted-env start:

```bash
NODE_ENV=development pnpm dotenvx run -f .env.development -- node dist/server/index.js
```

If Vite picks up encrypted `.env.production` and garbles `VITE_BASE_PATH`, rebuild client with `npx vite build --mode devbuild`.

Quality gate: build workspace packages first if needed, then `pnpm run validate`.

## Concept map

| Area         | Page                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture | [Monorepo structure](architecture/monorepo-structure.md) · [Client UI](architecture/client-ui.md)                                                                                                  |
| Workflows    | [Authentication](workflows/authentication.md) · [Database management](workflows/database-management.md) · [Development](workflows/development-workflow.md) · [WoR import](workflows/wor-import.md) |
| Domain       | [Games and collections](domain/games-and-collections.md) · [Warframe advanced progress](domain/warframe-advanced-progress.md)                                                                      |
| Operations   | [Environment configuration](operations/environment-configuration.md)                                                                                                                               |
| Testing      | [Validate and SQLite](testing/validate-and-sqlite.md)                                                                                                                                              |

## Agent gotchas

- `SESSION_DB_PATH` and `ARMORY_DB_PATH` must be **absolute**.
- Game DBs must be pre-created (`db:init`); server startup asserts required tables exist.
- `pnpm run validate` does **not** build workspace packages — build `@codex/*` first if `dist` is missing.
- Placeholder Clerk keys → middleware 500 on auth routes (server still listens).
- CI env template: `.github/ci.env.development`.
- Windows agent shells may prepend Node 22 — prefer system Node 26; rebuild `better-sqlite3` after Node changes.
- Cloud VM: PATH may prefer Node 22; tests may need writable `/data`.
- UI tokens mirrored manually with Armory (no shared UI package).
- README may understate WoR — code registers three games in `server/games/metadataRegistry.ts`.
