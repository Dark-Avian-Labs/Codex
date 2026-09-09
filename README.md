<p align="center">
  <img src="https://raw.githubusercontent.com/Dark-Avian-Labs/.github/refs/heads/main/banner.png" alt="Dark Avian Labs">
</p>

# Codex

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/Codex/ci.yml?style=flat-square&label=CI)](https://github.com/Dark-Avian-Labs/Codex/actions/workflows/ci.yml)
[![PR](https://img.shields.io/github/actions/workflow/status/Dark-Avian-Labs/Codex/pr.yml?style=flat-square&label=PR)](https://github.com/Dark-Avian-Labs/Codex/actions/workflows/pr.yml)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

Table-based collection tracker for Warframe, Epic Seven, and Watcher of Realms. Each game is its own workspace package. Warframe catalog data comes from Armory. Sign-in uses [Clerk](https://clerk.com).

Live: [codex.darkavianlabs.com](https://codex.darkavianlabs.com)

Default API port is **3001**.

## Gotchas

- `SESSION_DB_PATH` and `ARMORY_DB_PATH` must be **absolute**. Do not reuse Armory's session file, BudgetPlanner SQLite, or point both paths at the same database. Codex copies the Armory catalog into its Warframe DB; it does not live-join Armory forever.
- Workspace packages must be built before `db:init`, tests, or a server compile. `pnpm run build` does that; `pnpm run validate` does not. An empty Armory catalog means Warframe sync has nothing to copy — import in Armory first.
- Encrypted env files need `.env.keys` or `DOTENV_PRIVATE_KEY_*`. Never encrypt `VITE_*`.
- Empty Clerk keys skip auth. Placeholder keys are fatal. Production needs real keys, `APP_PUBLIC_BASE_URL`, and `COOKIE_DOMAIN=.darkavianlabs.com` to share login with Armory / Outfitter.
- After changing Node versions on Windows, `pnpm rebuild better-sqlite3`.

## License

MIT
