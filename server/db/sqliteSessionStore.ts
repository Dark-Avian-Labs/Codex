import { createSessionSchema } from '@codex/core';
import type Database from 'better-sqlite3';
import { Store } from 'express-session';
import type { SessionData } from 'express-session';

const DEFAULT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface SqliteSessionStoreOptions {
  db: Database.Database;
  /** Interval for purging expired rows. Set to 0 to disable. Default: 15 min. */
  cleanupIntervalMs?: number;
  /** Lifetime used when the session cookie has no expiry. Default: 1 day. */
  defaultTtlMs?: number;
}

type GetCallback = (err?: unknown, session?: SessionData | null) => void;
type DoneCallback = (err?: unknown) => void;

/**
 * In-repo express-session store on better-sqlite3, replacing the unmaintained
 * `better-sqlite3-session-store` package. Uses the `sessions` table from
 * @codex/core's createSessionSchema (same shape as before, so existing
 * session DBs keep working). Expiry values are ISO-8601 UTC strings, which
 * compare correctly as text.
 */
export class SqliteSessionStore extends Store {
  private readonly db: Database.Database;
  private readonly defaultTtlMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: SqliteSessionStoreOptions) {
    super();
    this.db = options.db;
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
    createSessionSchema(this.db);

    const interval = options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
    if (interval > 0) {
      this.cleanupTimer = setInterval(() => {
        try {
          this.clearExpired();
        } catch {
          // Keep the timer alive; a failed sweep retries on the next tick.
        }
      }, interval);
      this.cleanupTimer.unref();
    }
  }

  private expiryFor(session: SessionData): string {
    const expires = session.cookie?.expires;
    if (expires) {
      return new Date(expires).toISOString();
    }
    const maxAge = session.cookie?.maxAge;
    const ttl = typeof maxAge === 'number' && maxAge > 0 ? maxAge : this.defaultTtlMs;
    return new Date(Date.now() + ttl).toISOString();
  }

  override get(sid: string, callback: GetCallback): void {
    try {
      const row = this.db.prepare('SELECT sess, expire FROM sessions WHERE sid = ?').get(sid) as
        | { sess: string; expire: string }
        | undefined;
      if (!row) {
        callback();
        return;
      }
      if (row.expire <= new Date().toISOString()) {
        this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        callback();
        return;
      }
      callback(null, JSON.parse(row.sess) as SessionData);
    } catch (err) {
      callback(err);
    }
  }

  override set(sid: string, session: SessionData, callback?: DoneCallback): void {
    try {
      this.db
        .prepare(
          `INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`,
        )
        .run(sid, JSON.stringify(session), this.expiryFor(session));
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  override destroy(sid: string, callback?: DoneCallback): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  override touch(sid: string, session: SessionData, callback?: DoneCallback): void {
    try {
      this.db
        .prepare('UPDATE sessions SET expire = ? WHERE sid = ?')
        .run(this.expiryFor(session), sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  override length(callback: (err?: unknown, length?: number) => void): void {
    try {
      const row = this.db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as {
        count: number;
      };
      callback(null, row.count);
    } catch (err) {
      callback(err);
    }
  }

  override clear(callback?: DoneCallback): void {
    try {
      this.db.prepare('DELETE FROM sessions').run();
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  override all(callback: (err?: unknown, sessions?: SessionData[]) => void): void {
    try {
      const rows = this.db
        .prepare('SELECT sess FROM sessions WHERE expire > ?')
        .all(new Date().toISOString()) as Array<{ sess: string }>;
      callback(
        null,
        rows.map((row) => JSON.parse(row.sess) as SessionData),
      );
    } catch (err) {
      callback(err);
    }
  }

  /** Deletes expired rows. Returns the number of rows removed. */
  clearExpired(): number {
    const result = this.db
      .prepare('DELETE FROM sessions WHERE expire <= ?')
      .run(new Date().toISOString());
    return result.changes;
  }

  /** Stops the cleanup timer. Call during graceful shutdown. */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
