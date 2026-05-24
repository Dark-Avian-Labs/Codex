import path from 'path';

export function requireAbsoluteSqlitePath(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} must be set to an absolute SQLite path.`);
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`${name} must be absolute; relative paths are not supported.`);
  }
  return trimmed;
}
