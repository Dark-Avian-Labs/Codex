---
type: Operations Guide
title: Environment Configuration
description: Required env vars, absolute path rules, dotenvx, and Clerk/CORS settings for Codex.
tags: [ops, env, dotenvx, clerk]
timestamp: 2026-07-18T20:40:00Z
---

# Environment Configuration

Codex configuration is env-driven. Use `.env.example` and `.github/ci.env.development` as templates. Never commit real secrets or `.env.keys`. Auth behavior: [authentication](../workflows/authentication.md). Paths: [database management](../workflows/database-management.md).

## Critical variables

| Variable                                                | Notes                                           |
| ------------------------------------------------------- | ----------------------------------------------- |
| `SESSION_SECRET`                                        | Required; ≥32 characters                        |
| `BASE_DOMAIN` / `BASE_PROTOCOL`                         | Public URL derivation                           |
| `CLERK_SECRET_KEY`                                      | Required in production                          |
| `CLERK_PUBLISHABLE_KEY` or `VITE_CLERK_PUBLISHABLE_KEY` | Client/server publishable key                   |
| `SESSION_DB_PATH`                                       | **Absolute** Codex session DB                   |
| `ARMORY_DB_PATH`                                        | **Absolute** Armory catalog DB (read-only)      |
| `WARFRAME_DB_PATH`, `EPIC7_DB_PATH`, `WOR_DB_PATH`      | Per-game DBs (defaults under `./data/`)         |
| `PORT` / `HOST`                                         | Default port **3001**                           |
| `ALLOWED_APP_ORIGINS`                                   | Optional CORS sibling apps                      |
| `VITE_*`                                                | Client build-time settings (see `.env.example`) |

## dotenvx

Encrypted `.env.development` / `.env.production` decrypt at runtime when `DOTENV_PRIVATE_KEY_*` is set. Without the key, use a plain `.env` from the example/CI template.

## What to watch out for

- Encrypted `.env.production` can garble Vite `VITE_BASE_PATH` — use `--mode devbuild` for local client builds when needed.
- Relative Armory/session paths are rejected or unsafe in shared deploys — use absolute mounts.
- Placeholder Clerk keys break authenticated routes with 500s.

## Related

- [Authentication](../workflows/authentication.md)
- [Database management](../workflows/database-management.md)
- [Development workflow](../workflows/development-workflow.md)
- [Quickstart](../quickstart.md)
