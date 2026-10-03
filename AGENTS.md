# Codex

Shell, auth, env, and validate are in AppBase `AGENTS.md`. Port 3001. Playwright 3101. Signed-in Playwright 4101.

Collection tracker for Warframe, Epic Seven, and Watcher of Realms. Each game is its own package under `packages/`. Do not force one table UI across games.

## Shell

Leave these in place on a mirror pass.

- The page scrolls inside `main`. The shell is `h-dvh max-h-dvh overflow-hidden`.
- The header has an `app-subheader` slot.
- The open game sets the document title and favicon.

## Data

Build the workspace packages before tests, `db:init`, or a server compile. `pnpm run build` does this. `pnpm run validate` does not.

Do not point the session path and a catalog path at the same file, and do not reuse BudgetPlanner SQLite files. The session path is absolute. Catalog defaults are `data/warframe-catalog.db` and `data/wor-catalog.db`. Armory reads the Warframe catalog. Outfitter reads the WoR catalog.

`/readyz` also checks the game DBs and that both catalog files are readable.

Encrypted `.env.production` garbles `VITE_BASE_PATH` during `vite build`. Rebuild the client with `npx vite build --mode devbuild`.

Warframe sync yields between users. Force-release of the sync lease is refused while an in-process sync is still running. Sync preview is `POST /api/warframe/admin/sync-preview`.

Write advanced progress with the advanced-progress route into `row_advanced_progress`. Auto Orokin and auto Arcane force `true` for exalted and warframe auto-arcane, overwriting a stored `false`. Non-subsumable Excalibur Umbra Helminth may only be `Unavailable`.

WoR import writes the catalog DB, then copies `catalog_*` into `WOR_DB_PATH`. The app joins on the collection file. If the catalog is empty and the collection still has `catalog_heroes`, boot seeds the catalog once. An empty catalog at boot runs the startup pipeline. Failures log and the process stays up. Admin import returns 202.

Signed-in roster reads use `GET /api/wor/roster`. Steps are in `.cursor/skills/codex-wor-roster/SKILL.md`.
