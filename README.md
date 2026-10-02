<p align="center">
  <img src="https://raw.githubusercontent.com/Dark-Avian-Labs/.github/refs/heads/main/banner.png" alt="Dark Avian Labs">
</p>

# Codex

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
![Node](https://img.shields.io/badge/Node-%3E%3D26-339933?logo=node.js&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
[![Cursor](https://img.shields.io/badge/Cursor-IDE-141414?logo=cursor&logoColor=white&style=flat-square)](https://cursor.com)

Codex is a collection tracker for Warframe, Epic Seven, and Watcher of Realms. You sign in, pick a game, and mark what you own. A frame still waiting on a level, an Epic Seven hero on the way to SSS, and a Watcher of Realms artifact waiting on a promotion each get their own columns.

It is for players who want that checklist to survive a new patch, and a second account.

## Features

**Separate lists.** Warframe covers frames, weapons, companions, arcanes, and smaller categories like K-Drives. Epic Seven is heroes and artifacts. Watcher of Realms is heroes, artifacts, and demons. Search, filters, and a done-count sit on whichever list is open.

**Progress you click through.** Warframe cells go blank, Obtained, Complete, plus a Helminth mark on frames that can be subsumed. Advanced mode tracks rank for the normal version and the Prime. Epic Seven heroes step through imprint ratings up to SSS, and artifacts step through gauge levels. Watcher of Realms tracks ownership, then awakening, promotion, or level.

**Hide completed rows.** On Warframe and Watcher of Realms, finished items can drop off the list. Search brings them back.

**Named alts.** Epic Seven and Watcher of Realms can hold several accounts, and the checkmarks stay with the one you switch to. Warframe keeps one sheet per sign-in.

**warframe.market links.** A toggle adds a link on items that have a listing.

**Shared catalogs.** Warframe and Watcher of Realms lists are imported here. Armory and Outfitter read copies of them. Epic Seven stays on a curated list inside Codex.

## What you should know

Every list sits behind a Dark Avian Labs account. The same sign-in opens Armory, Outfitter, BudgetPlanner, and Sentinel, and the left rail jumps between those sites.

Codex keeps your account id and the progress you mark. Email and display name stay with the sign-in service. The sheet is private to your sign-in.

New items appear after a catalog import, which is an admin step. A drop from this morning can be missing until the next refresh.

Live: [codex.darkavianlabs.com](https://codex.darkavianlabs.com)

## Self-hosting

Node 26 or newer, and pnpm 12. Copy `.env.example` to `.env.production`. `pnpm start` looks for that file and will not boot without it.

```
pnpm install
pnpm run build
pnpm run db:init
pnpm start
```

`db:init` reads the compiled schemas, so it has to follow the build. The server then serves the built site on `PORT`.

An empty Warframe catalog starts an import on first boot. That needs outbound network and takes a while. Watcher of Realms comes up from a fixture in the repo. `pnpm run wor:import` replaces it with a full pull. Epic Seven starts with an empty list. Heroes and artifacts are added from the admin pages.

## License

MIT
