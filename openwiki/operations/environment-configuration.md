---
type: Operations Guide
title: Environment Configuration
description: Required env vars, absolute path rules, dotenvx, and Clerk/CORS settings for Codex.
tags: [ops, env, dotenvx, clerk]
timestamp: 2026-07-30T17:05:00Z
---

# Environment Configuration

Codex configuration is env-driven. Use `.env.example` and `.github/ci.env.development` as templates. Never commit real secrets or `.env.keys`. Auth behavior: [authentication](../workflows/authentication.md). Paths: [database management](../workflows/database-management.md).

## Critical variables

| Variable                                                | Notes                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `SESSION_SECRET`                                        | Required; ≥32 characters in production                                 |
| `ALLOW_INSECURE_DEV`                                    | Dev-only; `=1` allows hardcoded session-secret fallback when unset     |
| `BASE_DOMAIN` / `BASE_PROTOCOL` / `APP_SUBDOMAIN`       | Public URL derivation                                                  |
| `COOKIE_DOMAIN`                                         | Defaults to `.${BASE_DOMAIN}` so sibling apps share the session cookie |
| `CLERK_SECRET_KEY`                                      | Required in production                                                 |
| `CLERK_PUBLISHABLE_KEY` or `VITE_CLERK_PUBLISHABLE_KEY` | Client/server publishable key                                          |
| `SESSION_DB_PATH`                                       | **Absolute** Codex session DB                                          |
| `ARMORY_DB_PATH`                                        | **Absolute** Armory catalog DB (read-only)                             |
| `WARFRAME_DB_PATH`, `EPIC7_DB_PATH`, `WOR_DB_PATH`      | Per-game DBs (defaults under `./data/`)                                |
| `PORT` / `HOST`                                         | Default port **3001**; `HOST` defaults to **`127.0.0.1`**              |
| `SHUTDOWN_TIMEOUT_MS`                                   | Default **10000**; graceful shutdown then forced exit                  |
| `ALLOWED_APP_ORIGINS`                                   | Credentialed CORS / CSRF peers (full trust — keep minimal)             |
| `VITE_*`                                                | Client build-time settings (see `.env.example`)                        |

## Shared domain auth

Apps on `*.darkavianlabs.com` share Clerk identity and a domain-scoped Express session cookie (`COOKIE_DOMAIN`, SameSite=**Lax**). List every sibling origin in `ALLOWED_APP_ORIGINS`. Treat each entry as a full trust peer.

## dotenvx

Encrypted `.env.development` / `.env.production` decrypt at runtime when `DOTENV_PRIVATE_KEY_*` is set. Without the key, use a plain `.env` from the example/CI template.

## What to watch out for

- Encrypted `.env.production` can garble Vite `VITE_BASE_PATH` — use `--mode devbuild` for local client builds when needed.
- Relative Armory/session paths are rejected or unsafe in shared deploys — use absolute mounts.
- Placeholder Clerk keys break authenticated routes with 500s.
- Set `HOST=0.0.0.0` explicitly when the process must bind all interfaces behind a reverse proxy; the code default is loopback.
- `ensureDataDirs` creates game/session dirs but **not** the parent of `ARMORY_DB_PATH`.
- `/healthz` is liveness; `/readyz` checks session + game DBs + readable `ARMORY_DB_PATH`. Both are registered **before** rate-limited static mounts (`server/probes.ts`).
- `unhandledRejection` / `uncaughtException` run graceful shutdown and exit **1**.
- Production `index.html` is `Cache-Control: no-cache`; hashed `/assets` are immutable for a year.

## Related

- [Authentication](../workflows/authentication.md)
- [Database management](../workflows/database-management.md)
- [Development workflow](../workflows/development-workflow.md)
- [Quickstart](../quickstart.md)
