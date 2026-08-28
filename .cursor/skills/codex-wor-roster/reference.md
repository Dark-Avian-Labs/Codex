# Extra Codex WoR API notes

Base: `https://codex.darkavianlabs.com`

All `/api/wor/*` routes except public health checks require a signed-in Clerk user. Data is scoped to that user's active game account.

## Read

| Method | Path                  | Notes                                             |
| ------ | --------------------- | ------------------------------------------------- |
| GET    | `/api/auth/me`        | `{ authenticated, userId }`                       |
| GET    | `/api/wor/user`       | Clerk id + accounts + current account             |
| GET    | `/api/wor/accounts`   | `{ accounts, current_account_id }`                |
| GET    | `/api/wor/roster`     | Compact agent roster (owned-only by default)      |
| GET    | `/api/wor/heroes`     | Full catalog rows for the UI (`owned` is `0`/`1`) |
| GET    | `/api/wor/artifacts`  | Same for artifacts                                |
| GET    | `/api/wor/demons`     | Same for demons                                   |
| GET    | `/api/wor/worksheets` | `{ heroes, artifacts, demons }` tab ids           |

Hero UI filters also work on `/api/wor/heroes`: `?class=`, `?faction=`, `?rarity=` (3/4/5).

## Mutate (CSRF required)

1. `GET /api/auth/csrf` → `{ csrfToken }`
2. Send `X-CSRF-Token: <csrfToken>` and `Content-Type: application/json`
3. Stay same-origin (browser on `codex.darkavianlabs.com`)

| Method | Path                           | Body                             |
| ------ | ------------------------------ | -------------------------------- |
| POST   | `/api/wor/accounts/switch`     | `{ "account_id": number }`       |
| PATCH  | `/api/wor/heroes/:id/owned`    | `{ "owned": 0 \| 1 }`            |
| PATCH  | `/api/wor/heroes/:id/gauge`    | `{ "gauge_level": 0-5 }`         |
| PATCH  | `/api/wor/artifacts/:id/owned` | `{ "owned": 0 \| 1 }`            |
| PATCH  | `/api/wor/artifacts/:id/gauge` | `{ "gauge_level": 0-5 }`         |
| PATCH  | `/api/wor/demons/:id/owned`    | `{ "owned": 0 \| 1 }`            |
| PATCH  | `/api/wor/demons/:id/gauge`    | `{ "gauge_level": 0-max_level }` |

Unowning a row also resets its gauge to 0. Do not create/rename/delete accounts unless the user asks.

Admin import (`/api/wor/admin/*`) is Codex-admin only. Do not call it.
