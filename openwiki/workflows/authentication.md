---
type: Workflow
title: Authentication
description: Clerk identity, Codex admin role, and CSRF-backed sessions for API mutations.
tags: [auth, clerk, csrf, admin]
timestamp: 2026-07-30T17:05:00Z
---

# Authentication

Codex authenticates users with Clerk and uses Express sessions (SQLite) for CSRF on mutating requests. Admin checks gate Warframe sync, Epic7 base catalog edits, and WoR admin import. Config details: [environment configuration](../operations/environment-configuration.md).

## Where to start

| Concern       | Path                                                                              |
| ------------- | --------------------------------------------------------------------------------- |
| Middleware    | `packages/core/src/middleware/auth.ts`                                            |
| Clerk helpers | `packages/core/src/auth/clerk.ts`                                                 |
| Auth routes   | `server/routes/auth.ts`                                                           |
| Session DB    | `packages/core/src/db/sessionSchema.ts`, extended in `server/db/sessionSchema.ts` |
| CSRF compare  | `server/http/timingSafeEqual.ts` (timing-safe token check around csrf-sync)       |

## Behavior

1. Clerk middleware attaches auth state to requests.
2. `requireAuthApi` rejects unauthenticated API callers.
3. `requireCodexAdmin` / `requireAdmin` requires session claims metadata `apps.codex === 'admin'` (via `isAppAdmin` + app id).
4. CSRF sync uses the session store at `SESSION_DB_PATH` (must be absolute); token comparison is timing-safe.
5. Client uses `@clerk/react` for sign-in/up and profile flows.
6. Domain-wide session cookie + `ALLOWED_APP_ORIGINS` enable sibling-app trust on the same apex (see environment config).
7. Authenticated `/api` responses set `Cache-Control: no-store`.

## What to watch out for

- Placeholder Clerk keys cause **500** responses from middleware — expected without real keys.
- Admin is Clerk metadata, not a Codex SQLite role table.
- Session DB also holds Warframe sync job/lease tables — treat it as Codex-owned infrastructure, not Armory’s session file.
- Missing `SESSION_SECRET` outside production requires `ALLOW_INSECURE_DEV=1`.

## Related

- [Monorepo structure](../architecture/monorepo-structure.md)
- [Environment configuration](../operations/environment-configuration.md)
- [Games and collections](../domain/games-and-collections.md)
- [Database management](database-management.md) (Warframe sync leases)
