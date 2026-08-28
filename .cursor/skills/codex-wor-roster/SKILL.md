---
name: codex-wor-roster
description: Fetches the user's Watcher of Realms collection from Codex JSON APIs using the signed-in browser session. Use when answering Watcher of Realms roster, ownership, awakening, artifact, demon, team-building, or pull questions that need the user's Codex account, or when an agent should read Codex instead of scraping the UI.
---

# Codex Watcher of Realms roster

Do not scrape `https://codex.darkavianlabs.com/wor`. The page is for humans. Codex already exposes authenticated JSON.

## Auth

Production origin: `https://codex.darkavianlabs.com`

Clerk cookies on the user's Chrome profile are enough. SameSite=Lax, so they are sent on **top-level navigations** to that origin. They are **not** sent by sandbox `curl`/`fetch` without those cookies.

1. Use the browser that already has the Codex login (same Chrome profile).
2. If a request returns **401**, open `https://codex.darkavianlabs.com/wor` in that browser, confirm the roster UI loads, then retry.
3. Prefer navigating the browser to the API URL (cookies attach automatically) over a cross-origin fetch.
4. Never paste session cookies, Clerk tokens, or CSRF tokens into chat.

GET requests do not need CSRF. Do not PATCH/POST unless the user explicitly asks to change the roster.

## Fetch the roster

**Preferred** (compact, owned-only, one request):

```
https://codex.darkavianlabs.com/api/wor/roster
```

Query params:

| Param     | Default                   | Values                                    |
| --------- | ------------------------- | ----------------------------------------- |
| `owned`   | `1` (owned only)          | `1` / `owned`, `0` / `unowned`, `all`     |
| `include` | `heroes,artifacts,demons` | any comma subset of those                 |
| `class`   | (none)                    | hero class key, e.g. `mage`               |
| `faction` | (none)                    | faction key; matches primary or secondary |
| `rarity`  | (none)                    | hero star filter: `3`, `4`, or `5`        |

If that URL returns **404**, production has not deployed the roster route yet. Fall back to the UI endpoints and keep only `owned === 1`:

- `GET /api/wor/heroes`
- `GET /api/wor/artifacts`
- `GET /api/wor/demons`
- `GET /api/wor/accounts` — confirm which game account is active

Do not hammer the API. There is a rate limit (~1200 requests / 15 minutes). Cache the roster for the rest of the conversation unless the user says they just changed it.

## Response shape (`/api/wor/roster`)

```json
{
  "account": { "id": 1, "name": "Main" },
  "stats": {
    "heroes": { "total": 200, "owned": 80, "maxed": 12 },
    "artifacts": { "total": 150, "owned": 40, "maxed": 5 },
    "demons": { "total": 20, "owned": 8, "maxed": 2 }
  },
  "gauge_max": { "heroes": 5, "artifacts": 5 },
  "heroes": [{ "slug": "lian", "name": "Lian", "owned": true, "awakening": 3 }],
  "artifacts": [{ "slug": "…", "owned": true, "promotion": 2 }],
  "demons": [{ "slug": "…", "owned": true, "level": 4, "max_level": 5 }]
}
```

`stats` is always the full account (not filtered by `owned=`). Lists follow `owned` / `include` / hero filters.

### Field meanings

- **Hero `awakening`**: 0–5 (A0–A5). Max is `gauge_max.heroes`.
- **Artifact `promotion`**: 0–5. Max is `gauge_max.artifacts`.
- **Demon `level`**: owned demons are 1–`max_level` (usually 5); 0 means unowned. `rarity: "captain"` is a red-star / captain demon.
- **Hero `is_lord`**: red-star / lord hero.
- **`faction_secondary`**: dual-faction; treat either faction as a match.
- **`reference_tier`**: imported tier hint; may be null.
- **`id`**: Codex row id (needed only if the user asks you to mutate).

Class keys: `fighter`, `mage`, `marksman`, `defender`, `healer`, `tactician`.

Faction keys: `watchguard`, `north_throne`, `nightmare_council`, `cursed_cult`, `infernal_blast`, `star_piercers`, `esoteria_order`, `chaos_dominion`, `supreme_arbiters`, `unnamable`, `unaffiliated`.

## Errors

| Status | Meaning                                              | What to do                                  |
| ------ | ---------------------------------------------------- | ------------------------------------------- |
| 401    | Not signed in                                        | Open `/wor` in the same browser, then retry |
| 400    | No Watcher of Realms game account on this Clerk user | Tell the user to create one in Codex        |
| 404    | Unknown path (old server) or missing row on PATCH    | Use the fallback GETs above                 |
| 403    | CSRF / origin on a mutating request                  | Stop; do not retry mutations unless asked   |

## Mutations (only if asked)

See [reference.md](reference.md). Default is read-only.

## How to use this as GrokBot

Add this skill to the bot, and/or paste this rule:

> When you need my Watcher of Realms collection, use the `codex-wor-roster` skill. Fetch Codex JSON with my existing Chrome login. Do not scrape the Codex UI.
