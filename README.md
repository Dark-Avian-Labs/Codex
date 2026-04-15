# Corpus

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white)](https://cursor.com)
![Node](https://img.shields.io/badge/Node-%3E%3D25-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)

Corpus is a table-based collection tracker for games. Support for each game lives in workspace packages (Epic7 with a manually curated list, Warframe backed by data synced from Parametric). The app uses the central Auth service for login, access control, and profile settings.

## Requirements

- Node.js 25+
- pnpm 11+

## Setup

1. Install Node.js and pnpm using your preferred method for your OS.

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy and edit the environment file:

   ```bash
   cp .env.example .env
   nano .env
   ```

4. Build and run:

   ```bash
   pnpm run build
   pnpm start
   ```

## dotenvx and encrypted env files

This project supports `dotenvx` for local `.env` loading and can optionally use encrypted env artifacts.

- Use `pnpm dlx dotenvx encrypt` to encrypt your local `.env` file when you want it safe to commit.
- That flow also creates a `.env.keys` file with your private encryption key, which must **never** be committed.
- To change variables, use `pnpm dlx dotenvx decrypt` with the key in `.env.keys` to restore a plain `.env`.
- Re-encrypt afterward (keys are reused) and commit only the encrypted artifacts.
- Store private keys in your secrets manager the same way you would an SSH deploy key.

Suggested secret naming when vault is enabled:

- `DOTENV_PRIVATE_KEY_DEVELOPMENT`
- `DOTENV_PRIVATE_KEY_PRODUCTION`

Use one key per environment to reduce blast radius.

## Environment variables

| Variable                            | Description                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `PORT`, `HOST`                      | Server bind address (defaults: `3001`, `0.0.0.0`).                          |
| `NODE_ENV`                          | Typically `development`, `test`, or `production`.                           |
| `SESSION_SECRET`                    | Required; at least 32 characters.                                           |
| `TRUST_PROXY`                       | Optional; set to `1` behind a reverse proxy (default: off).                 |
| `SECURE_COOKIES`                    | Optional; defaults to on in production.                                     |
| `BASE_DOMAIN`                       | Required. Apex domain (e.g. `example.com`).                                 |
| `BASE_PROTOCOL`                     | `http` or `https` (invalid values fall back to `https` with a warning).     |
| `APP_ID`                            | Corpus app id (default: `corpus`).                                          |
| `APP_SUBDOMAIN`                     | Public host subdomain (default: `APP_ID`). Used to build the public URL.    |
| `AUTH_SERVICE_URL`                  | Required. Shared Auth base URL (`https://…`).                               |
| `CENTRAL_DB_PATH`                   | **Required absolute path** to the shared Auth SQLite database.              |
| `PARAMETRIC_DB_PATH`                | **Required absolute path** to the shared Parametric SQLite database.        |
| `WARFRAME_DB_PATH`, `EPIC7_DB_PATH` | Per-game SQLite paths (defaults under `./data/` if unset in game packages). |
| `COOKIE_DOMAIN`                     | Optional; normalized to a leading-dot cookie domain.                        |
| `SESSION_COOKIE_NAME`               | Session cookie name for Corpus.                                             |
| `GAME_HOSTS`                        | Optional `host=gameId` pairs for routing (see `@corpus/core` config).       |
| `ALLOWED_APP_ORIGINS`               | Optional; used with CORS configuration in the server.                       |

Client `VITE_*` variables are listed in `.env.example`.

### Shared SQLite deployment notes

- `CENTRAL_DB_PATH` and `PARAMETRIC_DB_PATH` must be absolute paths on the host or inside the Corpus runtime container.
- Avoid relative `../other-service/...` paths; mount shared volumes explicitly for each service.
- Corpus opens the central DB in WAL mode; keep a single writer boundary for schema changes and avoid multi-host writes on network filesystems that do not honor SQLite locking.

## Scripts

| Script                  | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `pnpm run build`        | Build workspace packages, typecheck, compile server, and Vite client build. |
| `pnpm start`            | Run production server from `dist/`.                                         |
| `pnpm run typecheck`    | Typecheck server and client.                                                |
| `pnpm run lint`         | Run Oxlint.                                                                 |
| `pnpm run lint:fix`     | Run Oxlint with `--fix`.                                                    |
| `pnpm run format`       | Run Oxfmt.                                                                  |
| `pnpm run check-format` | Verify Oxfmt formatting.                                                    |
| `pnpm run validate`     | Format check, lint, typecheck, and tests.                                   |
| `pnpm run test`         | Run Vitest once.                                                            |
| `pnpm run test:watch`   | Run Vitest in watch mode.                                                   |

## License

GPL-3.0-or-later
