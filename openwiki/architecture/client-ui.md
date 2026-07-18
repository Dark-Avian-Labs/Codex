---
type: Architecture Overview
title: Client UI Architecture
description: Codex SPA feature layout, routing, Layout slots, and the three game UX models.
tags: [client, react, ui, features]
timestamp: 2026-07-18T21:05:00Z
---

# Client UI Architecture

The Codex SPA lives under `client/`. Feature folders own game and admin UIs; shared chrome uses Layout outlet slots. Game UX models differ — Warframe is worksheet/cell driven; Epic Seven and Watcher of Realms are account + catalog lists. This deepens [monorepo structure](monorepo-structure.md) and [games and collections](../domain/games-and-collections.md). Auth wrappers: [authentication](../workflows/authentication.md).

## Where to start

| Concern           | Path                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| Entry / app shell | `client/main.tsx`, `client/App.tsx`                                            |
| Routes / paths    | `client/app/routes.tsx`, `client/app/paths.ts`                                 |
| Layout slots      | `client/components/Layout/Layout.tsx`, `useLayoutSlots.ts`                     |
| Shared UI         | `client/components/ui/` (`Modal`, `SelectDropdown`, `LazySuspenseFallback`, …) |
| Warframe          | `client/features/warframe/`                                                    |
| Epic7 / WoR       | `client/features/epic7/Epic7Page.tsx`, `client/features/wor/WorPage.tsx`       |
| Admin             | `client/features/admin/`                                                       |
| API helper        | `client/utils/api.ts`                                                          |

## Routing

`APP_PATHS` covers `/`, sign-in/up, `/warframe`, `/epic7`, `/wor`, per-game `/…/admin`, and `/legal`. `/admin` redirects toward Epic7 admin. Routes are lazy-loaded with chunk error boundaries; Suspense uses `LazySuspenseFallback`.

Layout brand/admin links switch by pathname prefix (`warframe` / `epic7` / `wor`). Header search/actions mount through `useLayoutSlots`.

## UX models

| Game       | Pattern                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Warframe   | Worksheets → table rows → cell status cycles (`Obtained` / `Complete`) and Helminth; optional [advanced progress](../domain/warframe-advanced-progress.md) |
| Epic Seven | Account switcher + hero/artifact tabs, gauges, owned toggles                                                                                               |
| WoR        | Account switcher + heroes/artifacts/demons tabs                                                                                                            |

There is no shared “collection table” abstraction across games — do not force Warframe worksheet patterns onto Epic7/WoR.

## What to watch out for

- Epic7 and WoR pages are large monoliths; prefer targeted edits.
- Warframe tab order uses client `TAB_ORDER`, not raw DB order alone.
- UI tokens are mirrored manually with Armory (no shared UI package) — see root AGENTS.md.

## Related

- [Monorepo structure](monorepo-structure.md)
- [Games and collections](../domain/games-and-collections.md)
- [Warframe advanced progress](../domain/warframe-advanced-progress.md)
- [Authentication](../workflows/authentication.md)
