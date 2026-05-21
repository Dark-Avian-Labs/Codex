# Codex

## Cursor Cloud specific instructions

### Overview

Codex is a table-based game collection tracker (Warframe and Epic Seven). It is a pnpm workspace monorepo with packages under `packages/`. It uses the central Auth service for login and reads Armory's SQLite database for Warframe data sync.

### Running the service

See `README.md` for standard scripts (`pnpm run build`, `pnpm start`, `pnpm run validate`, etc.).

To start in development mode after building:

```bash
NODE_ENV=development node --env-file=.env dist/server/index.js
```

The server listens on port 3001 by default.

### Key gotchas

- **Node >= 25 and pnpm >= 11 required.** Use `nvm install 25` and `npm install -g pnpm@11.1.3`.
- **Workspace packages must be built before tests or main build.** Run `pnpm --filter @codex/core --filter @codex/game-warframe --filter @codex/game-epic7 run --if-present build` before `pnpm run test`. The full `pnpm run build` command does this automatically, but `pnpm run test` alone does not.
- **Encrypted `.env.development` / `.env.production` files.** Create a plain `.env` from `.env.example`. Run with `node --env-file=.env` to preload env vars.
- **`CENTRAL_DB_PATH` and `ARMORY_DB_PATH` must be absolute paths.** These point to Auth's `central.db` and Armory's `armory.db`. In a multi-repo setup, use absolute paths like `/agent/repos/Auth/data/central.db`.
- **Game databases must be pre-created.** The Warframe and Epic7 SQLite databases need their schemas initialized before first start. The `onOpen` callbacks in the game packages assume tables already exist. Pre-create schemas using the SQL in `packages/games/warframe/src/db/schema.ts` and `packages/games/epic7/src/db/schema.ts`.
- **Vite build picks up encrypted `.env.production`** for `VITE_BASE_PATH`, producing garbled asset paths. Fix by rebuilding the client with: `npx vite build --mode devbuild`.
- **`AUTH_SERVICE_URL` must start with `https://`** even in dev. Use `https://auth.example.test` as a placeholder. Actual auth integration requires the Auth service to be reachable over HTTPS or a matching domain setup.
- **CI env template** at `.github/ci.env.development` provides a good reference for all required env vars.
