# Codex

## Cursor Cloud specific instructions

### Overview

Codex is a table-based game collection tracker (Warframe and Epic Seven). It is a pnpm workspace monorepo with packages under `packages/`. It uses Clerk for authentication and reads Armory's SQLite database for Warframe data sync.

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
- **`SESSION_DB_PATH` and `ARMORY_DB_PATH` must be absolute paths.** `SESSION_DB_PATH` is Codex-owned (`session.db` for CSRF / Epic7 session state). `ARMORY_DB_PATH` is the read-only Armory catalog. Example: `/var/www/applications/codex/data/session.db`.
- **Game databases must be pre-created.** The Warframe and Epic7 SQLite databases need their schemas initialized before first start. The `onOpen` callbacks in the game packages assume tables already exist. Pre-create schemas using the SQL in `packages/games/warframe/src/db/schema.ts` and `packages/games/epic7/src/db/schema.ts`.
- **Vite build picks up encrypted `.env.production`** for `VITE_BASE_PATH`, producing garbled asset paths. Fix by rebuilding the client with: `npx vite build --mode devbuild`.
- **Clerk keys are required in production.** Set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` (or `VITE_CLERK_PUBLISHABLE_KEY`). See `.env.example` for session-token metadata and admin role setup.
- **CI env template** at `.github/ci.env.development` provides a good reference for all required env vars.
- **Tests:** `pnpm run test` and `pnpm run test:coverage` (build workspace packages first if needed). SQLite tests use `tests/helpers/sqliteTestHarness.ts`; CI fails if native bindings are missing. On Windows, Cursor agent shells prepend bundled Node 22 — `.cursor/hooks/prepend-system-node.ps1` rewrites Shell commands to prefer `C:\Program Files\nodejs`. After changing Node versions, run `pnpm rebuild better-sqlite3`.

### Cloud VM-specific notes

- **PATH override:** The Cloud VM has `/exec-daemon/node` (Node 22) ahead of nvm in PATH. Prepend nvm's Node 25 path: `export PATH="/home/ubuntu/.nvm/versions/node/v25.9.0/bin:$PATH"`.
- **`/data` directory for tests:** Vitest resolves `PROJECT_ROOT` as `/` (because `server/config.ts` computes it relative to the TS source file). The `ensureDataDirs()` call tries to create `/data`. Run `sudo mkdir -p /data && sudo chmod 777 /data` before tests.
- **Decrypt `.env.development`:** If `DOTENV_PRIVATE_KEY_DEVELOPMENT` is available as a secret, run `pnpm dotenvx decrypt -f .env.development`. Without the key, copy the CI plaintext template: `cp .github/ci.env.development .env.development` and append absolute DB paths.
- **Clerk publishable key format (fallback only):** If using placeholder keys, must be `pk_test_<base64_of_fapi_host$>`. With decrypted `.env.development`, real keys are used automatically.
- **Build order for dev server:** (1) `pnpm run build` (or build workspace packages + tsc), then (2) `npx vite build --mode devbuild` to avoid garbled asset paths from encrypted `.env.production`.

### UI consistency

Armory and Codex mirror the same design tokens and component patterns manually (no shared UI package). When changing layout, glass surfaces, buttons, modals, or dropdowns in one app, apply the same change in the other.

| Area                | Spec                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout max width    | `max-w-[2000px]` on header, main content wrapper, and footer                                                                                |
| Glass surfaces      | `glass-surface` (panels/cards), `glass-modal-surface` (dialogs), `glass-shell` (auth shells)                                                |
| Header nav          | `header-link` with `.active` modifier — 40px height, 1rem radius, accent tokens when active                                                 |
| Buttons             | `btn btn-accent`, `btn btn-danger`, `btn btn-cancel` (modal dismiss), `btn btn-secondary` (neutral actions)                                 |
| Modals              | Use `Modal` component; `className` includes `glass-modal-surface`; footers use `modal-actions`                                              |
| Dropdowns           | `SelectDropdown` with `triggerClassName` / `placement` props; user-menu triggers use `user-menu-select-trigger`                             |
| Stale client banner | Gold `stale-update-cta` button with `stale-update-cta__label` text "Refresh now!"                                                           |
| Suspense fallback   | `LazySuspenseFallback` component                                                                                                            |
| Toasts              | `.toast-pill` with optional `data-tone="success\|error\|warning"`                                                                           |
| Form focus          | `.form-input:focus` and `.form-group input:focus` — accent border + soft glow (`box-shadow` ring)                                           |
| Theme keys          | `--color-accent`, `--color-glass-border`, `--color-glass`, `--radius-ui`, `--shadow-panel`; UI style via `html.ui-clear` / `html.ui-shadow` |
