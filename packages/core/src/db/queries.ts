import Database from 'better-sqlite3';

export function getAllUsers(db: Database.Database): {
  id: number;
  username: string;
  is_admin: number;
  created_at: string;
}[] {
  return db
    .prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at ASC')
    .all() as {
    id: number;
    username: string;
    is_admin: number;
    created_at: string;
  }[];
}

export function getGamesForUser(db: Database.Database, userId: number): string[] {
  const rows = db.prepare('SELECT game_id FROM user_game_access WHERE user_id = ?').all(userId) as {
    game_id: string;
  }[];
  return rows.map((r) => r.game_id);
}

export function hasAccess(db: Database.Database, userId: number, gameId: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM user_game_access WHERE user_id = ? AND game_id = ?')
    .get(userId, gameId);
  return !!row;
}

export function grantGameAccess(db: Database.Database, userId: number, gameId: string): boolean {
  const r = db
    .prepare('INSERT OR IGNORE INTO user_game_access (user_id, game_id) VALUES (?, ?)')
    .run(userId, gameId);
  return r.changes > 0;
}

export function revokeGameAccess(db: Database.Database, userId: number, gameId: string): boolean {
  const r = db
    .prepare('DELETE FROM user_game_access WHERE user_id = ? AND game_id = ?')
    .run(userId, gameId);
  return r.changes > 0;
}

export function setUserGameAccess(
  db: Database.Database,
  userId: number,
  gameId: string,
  enabled: boolean,
): boolean {
  if (enabled) {
    return grantGameAccess(db, userId, gameId);
  }
  return revokeGameAccess(db, userId, gameId);
}
