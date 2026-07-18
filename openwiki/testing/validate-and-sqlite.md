---
type: Testing Guide
title: Validate and SQLite
description: Runtime preflight, Vitest SQLite harness, and the Codex validate quality gate.
tags: [testing, vitest, sqlite, validate]
timestamp: 2026-07-18T20:40:00Z
---

# Validate and SQLite

Codex’s quality gate is `pnpm run validate` (`run-quality-checks.mjs`). It starts with runtime preflight, then format, lint, typecheck, and Vitest. Build [workspace packages](../architecture/monorepo-structure.md) first when `dist` is missing — see [development workflow](../workflows/development-workflow.md).

## Where to start

| Concern   | Path                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------- |
| Validate  | `run-quality-checks.mjs`                                                                           |
| Preflight | `scripts/runtime-preflight.mjs` (Node 26+, pnpm major from `packageManager`, better-sqlite3 probe) |
| Vitest    | `vitest.config.ts`, `tests/globalSetup.sqlite.ts`                                                  |
| Harness   | `tests/helpers/sqliteTestHarness.ts`, `describeWithSqlite.ts`, `sqliteNative.ts`                   |

## Behavior

- Suites live under `tests/`, `server/**/*.test.ts`, packages, and client.
- SQLite-dependent tests use the harness; CI fails if native bindings cannot load.
- Cloud/agent environments may need a writable data directory (AGENTS notes `/data` on some VMs).

## What to watch out for

- Windows agent Node 22 vs system Node 26 — wrong Node breaks `better-sqlite3`.
- Do not treat skipped-native as green for SQLite regressions when bindings are actually required.
- Auth/admin tests typically mock Clerk claims rather than calling live Clerk.

## Related

- [Development workflow](../workflows/development-workflow.md)
- [Environment configuration](../operations/environment-configuration.md)
- [Quickstart](../quickstart.md)
