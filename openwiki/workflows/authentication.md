---
type: Workflow
title: Authentication
description: Clerk identity, Codex admin role, and CSRF-backed sessions for API mutations.
tags: [auth, clerk, csrf, admin]
timestamp: 2026-07-18T20:40:00Z
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

## Behavior

1. Clerk middleware attaches auth state to requests.
2. `requireAuthApi` rejects unauthenticated API callers.
3. `requireCodexAdmin` / `requireAdmin` requires session claims metadata `apps.codex === 'admin'` (via `isAppAdmin` + app id).
4. CSRF sync uses the session store at `SESSION_DB_PATH` (must be absolute).
5. Client uses `@clerk/react` for sign-in/up and profile flows.

## What to watch out for

- Placeholder Clerk keys cause **500** responses from middleware — expected without real keys.
- Admin is Clerk metadata, not a Codex SQLite role table.
- Session DB also holds Warframe sync job/lease tables — treat it as Codex-owned infrastructure, not Armory’s session file.

## Related

- [Monorepo structure](../architecture/monorepo-structure.md)
- [Environment configuration](../operations/environment-configuration.md)
- [Games and collections](../domain/games-and-collections.md)
