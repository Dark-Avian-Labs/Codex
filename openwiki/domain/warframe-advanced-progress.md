---
type: Domain Concept
title: Warframe Advanced Progress
description: Per-row advanced mode fields, relevance rules, Helminth exceptions, and completion beyond classic cells.
tags: [warframe, advanced-progress, helminth, exalted]
timestamp: 2026-07-18T21:05:00Z
---

# Warframe Advanced Progress

Beyond classic worksheet cells (`Obtained` / `Complete`), Warframe optional **advanced mode** tracks per-row level, valence, element, Orokin, arcane, and exilus — for normal and prime variants. Rules live in `@codex/game-warframe`. Overview: [games and collections](games-and-collections.md). UI: [client UI](../architecture/client-ui.md). Schema: [database management](../workflows/database-management.md).

## Where to start

| Concern               | Path                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| Relevance rules       | `packages/games/warframe/src/advancedRules.ts`                       |
| Exalted / auto Orokin | `packages/games/warframe/src/exaltedWeapons.ts`                      |
| Helminth exceptions   | `packages/games/warframe/src/helminthExceptions.ts`                  |
| Resolve + persist     | `packages/games/warframe/src/db/queries.ts`                          |
| Table                 | `packages/games/warframe/src/db/schema.ts` → `row_advanced_progress` |
| API Zod               | `packages/games/warframe/src/routes/validation.ts`                   |
| HTTP                  | `server/routes/warframeApi.ts` (`PATCH …/advanced-progress`)         |
| Client completion     | `client/features/warframe/warframeUtils.ts`, `WarframeTableRow.tsx`  |
| Shared types          | `shared/warframeTypes.ts`                                            |

## Model

`row_advanced_progress` is keyed by `row_id` with normal fields plus `*_prime` counterparts (`level`, `valence_percent`, `has_element|orokin|arcane|exilus`).

**Relevance highlights** (`resolveAdvancedRowRelevance`):

- Max level 40 for Kuva/Tenet/Coda, Paracesis, Necramech accessories; else 30; Arcanes use catalog max rank / levelStats length
- Valence/element: Kuva/Tenet/Coda names only
- Orokin: generally on; auto-complete for exalted weapon names
- Arcane: off for Companions / Companion Weapons / K-Drives / Necramechs; Warframes auto-arcane
- Exilus: Warframes + listed weapon worksheets

Classic `cell_values` still matter for status columns. Helminth column: non-subsumable Excalibur Umbra may only be `Unavailable`; others use `''` / `Yes`.

## Completion (client advanced)

For each visible variant: reach max level, valence ≥ complete threshold when relevant, and required flags true. `show_all_variants` controls whether both normal and prime must complete. Stored valence snaps to complete once past an internal threshold (see package config).

## What to watch out for

- Advanced progress is **not** stored in `cell_values` — separate table + `PATCH /advanced-progress`.
- Auto Orokin/Arcane can overwrite stored false when resolving display state.
- Absolute API level clamp is 40 (`ABSOLUTE_MAX_ADVANCED_LEVEL`).
- Prime relevance is computed as if the item name were the Prime variant; presence of prime comes from row/column shape.

## Related

- [Games and collections](games-and-collections.md)
- [Client UI](../architecture/client-ui.md)
- [Database management](../workflows/database-management.md)
- [Monorepo structure](../architecture/monorepo-structure.md)
