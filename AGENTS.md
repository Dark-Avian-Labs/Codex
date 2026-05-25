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
