import type { CSSProperties } from 'react';
import { Link } from 'react-router';

import { APP_PATHS } from '../../app/paths';

const warframeStyle = { '--color-accent': '#ea580c' } as CSSProperties;
const epic7Style = { '--color-accent': '#a855f7' } as CSSProperties;
const worStyle = { '--color-accent': '#0ea5e9' } as CSSProperties;

export function HomePage() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Link to={APP_PATHS.warframe} className="game-card" style={warframeStyle}>
        <h2>Warframe</h2>
      </Link>
      <Link to={APP_PATHS.epic7} className="game-card" style={epic7Style}>
        <h2>Epic Seven</h2>
      </Link>
      <Link to={APP_PATHS.wor} className="game-card" style={worStyle}>
        <h2>Watcher of Realms</h2>
      </Link>
    </div>
  );
}
