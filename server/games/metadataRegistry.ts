export type GameAppMetadata = {
  label: string;
  subtitle: string;
  url: string;
};

export const CODEX_GAMES = ['warframe', 'epic7', 'wor'] as const;

const gameMetadataRegistry = new Map<string, GameAppMetadata>();

export function registerGame(gameId: string, metadata: GameAppMetadata): void {
  gameMetadataRegistry.set(gameId, metadata);
}

export function getGameMetadata(gameId: string): GameAppMetadata | undefined {
  return gameMetadataRegistry.get(gameId);
}

export const unknownGameMetadata: GameAppMetadata = {
  label: 'Unknown Game',
  subtitle: 'Unknown app',
  url: '/',
};

registerGame('warframe', {
  label: 'Warframe',
  subtitle: 'Inventory tracker',
  url: '/warframe',
});

registerGame('epic7', {
  label: 'Epic Seven',
  subtitle: 'Collection tracker',
  url: '/epic7',
});

registerGame('wor', {
  label: 'Watcher of Realms',
  subtitle: 'Heroes, artifacts & demons',
  url: '/wor',
});
