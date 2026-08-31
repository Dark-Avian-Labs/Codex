import {
  ARTIFACT_GAUGE_EMPTY,
  ARTIFACT_GAUGE_FILLED,
  CLASS_DISPLAY_NAMES,
  FACTION_DISPLAY_NAMES,
  FACTIONS,
  GAUGE_COLORS,
  HERO_AWAKENING_LABELS,
  HERO_CLASSES,
  DEMON_LEVEL_MIN,
} from '@codex/game-wor/constants';
import type { FactionKey, HeroClassKey } from '@codex/game-wor/constants';
import { memo, useEffect, useState, type ReactNode } from 'react';

import { MaterialSymbol } from '../../components/ui/MaterialSymbol';

export type WorTab = 'heroes' | 'artifacts' | 'demons';

export type WorHero = {
  id: number;
  name: string;
  class: string;
  faction: string;
  faction_secondary?: string | null;
  star_rating?: number;
  is_lord?: number;
  is_regular?: number;
  is_ancient?: number;
  is_limited?: number;
  owned: number;
  gauge_level: number;
  reference_tier?: string | null;
  portrait_path?: string | null;
};

export type WorArtifact = {
  id: number;
  name: string;
  class?: string | null;
  star_rating?: number;
  owned: number;
  gauge_level: number;
  reference_tier?: string | null;
  portrait_path?: string | null;
  exclusive_hero_slug?: string | null;
  exclusive_hero_name?: string | null;
  exclusive_hero_portrait?: string | null;
  is_universal?: number;
};

export type WorDemon = {
  id: number;
  name: string;
  rarity?: string;
  star_rating?: number;
  owned: number;
  gauge_level: number;
  max_level: number;
  portrait_path?: string | null;
};

export type WorAccount = {
  id: number;
  account_name: string;
  is_active?: number;
};

export type WorStats = { total: number; owned: number; maxed: number };

const ICON_MODULES = import.meta.glob('../../../packages/games/wor/assets/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const ICONS: Record<string, string> = {};
for (const [assetPath, src] of Object.entries(ICON_MODULES)) {
  const file = assetPath.split('/').pop();
  if (!file) continue;
  ICONS[file.replace('.png', '')] = src;
}

export const HIDE_COMPLETED_STORAGE_KEY = 'codex-wor-hide-completed';

export function readHideCompletedPreference(): boolean {
  try {
    return localStorage.getItem(HIDE_COMPLETED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function applyHideCompleted<T extends { owned: number }>(
  rows: T[],
  search: string,
  hideCompleted: boolean,
): T[] {
  if (!hideCompleted || search.trim().length > 0) return rows;
  return rows.filter((row) => row.owned !== 1);
}

export function gaugeAfterOwnedToggle(
  entity: WorTab,
  currentGauge: number,
  nextOwned: number,
): number {
  if (nextOwned === 0) return 0;
  if (entity === 'demons') return Math.max(currentGauge, DEMON_LEVEL_MIN);
  return currentGauge;
}

export function renderStars(count?: number, iconKey?: string): string | ReactNode {
  if (!count || count <= 0) return '-';
  const iconSrc = ICONS[iconKey ?? `star${count}`];
  if (!iconSrc) return `${count}★`;
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <img
          key={`${count}-${index}`}
          src={iconSrc}
          alt={`${count} stars`}
          title={`${count} stars`}
        />
      ))}
    </>
  );
}

export function renderGauge(level: number, max: number): string {
  const filled = Math.max(0, Math.min(level, max));
  return `${ARTIFACT_GAUGE_FILLED.repeat(filled)}${ARTIFACT_GAUGE_EMPTY.repeat(Math.max(0, max - filled))}`;
}

export function ownedButtonClass(owned: number, interactive: boolean): string {
  if (!interactive) {
    return owned
      ? 'status-btn helminth-btn yes cursor-default border-success/35 bg-success/10 text-success/80'
      : 'status-btn helminth-btn unavailable';
  }
  return owned ? 'status-btn helminth-btn yes' : 'status-btn helminth-btn empty';
}

export function ownedDisplay(owned: number): string {
  return owned ? '\u2713' : '\u2014';
}

export function isExclusiveArtifact(artifact: WorArtifact): boolean {
  return artifact.is_universal === 0 || Boolean(artifact.exclusive_hero_slug);
}

export function isRedStarHero(hero: WorHero): boolean {
  return Boolean(hero.is_lord);
}

export function isRedStarDemon(demon: WorDemon): boolean {
  return demon.rarity === 'captain';
}

export type SummonPoolBadge = 'regular' | 'ancient';

export function summonPoolBadge(
  hero: Pick<WorHero, 'is_regular' | 'is_ancient'>,
): SummonPoolBadge | null {
  if (hero.is_regular) return 'regular';
  if (hero.is_ancient) return 'ancient';
  return null;
}

export function portraitTitle(
  name: string,
  pool: SummonPoolBadge | null,
  isLimited: boolean | undefined,
): string {
  const tags: string[] = [];
  if (pool === 'regular') tags.push('Regular');
  if (pool === 'ancient') tags.push('Ancient');
  if (isLimited) tags.push('Limited');
  return tags.length > 0 ? `${name} (${tags.join(', ')})` : name;
}

export function WorPortrait({
  portraitPath,
  name,
  summonPool,
  isLimited,
}: {
  portraitPath?: string | null;
  name: string;
  summonPool?: SummonPoolBadge | null;
  isLimited?: boolean;
}) {
  const poolLabel =
    summonPool === 'regular' ? 'Regular pool' : summonPool === 'ancient' ? 'Ancient pool' : null;
  return (
    <span className="wor-portrait">
      {portraitPath ? (
        <img
          src={portraitPath}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          title={portraitTitle(name, summonPool ?? null, isLimited)}
        />
      ) : (
        <span className="wor-portrait-placeholder" aria-hidden="true" />
      )}
      {summonPool && poolLabel ? (
        <span
          className={`wor-pool-badge wor-pool-badge--${summonPool}`}
          title={poolLabel}
          role="img"
          aria-label={poolLabel}
        />
      ) : null}
      {isLimited ? (
        <span className="wor-limited-badge" title="Limited" role="img" aria-label="Limited">
          <MaterialSymbol name="timelapse" filled className="wor-limited-badge__icon" />
        </span>
      ) : null}
    </span>
  );
}

export function worClassIconUrls(classKey: HeroClassKey): { primary: string; fallback: string } {
  if (classKey === 'tactician') {
    const path = '/wor-images/icons/classes/tactician.png';
    return { primary: path, fallback: path };
  }
  return {
    primary: `/wor-images/icons/classes/${classKey}.svg`,
    fallback: `/wor-images/icons/classes/${classKey}.png`,
  };
}

export function worFactionIconUrls(factionKey: FactionKey): { primary: string; fallback: string } {
  return {
    primary: `/wor-images/icons/factions/${factionKey}.svg`,
    fallback: `/wor-images/icons/factions/${factionKey}.png`,
  };
}

export function WorIconWithFallback({
  primarySrc,
  fallbackSrc,
  alt,
  className,
  size = 28,
}: {
  primarySrc: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  const [src, setSrc] = useState(primarySrc);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setSrc(primarySrc);
    setFailed(false);
  }, [primarySrc]);
  if (failed) {
    return (
      <span
        className={className}
        title={alt}
        aria-label={alt}
        style={{ display: 'block', width: size, height: size }}
      />
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      title={alt}
      width={size}
      height={size}
      onError={() => {
        if (src !== fallbackSrc) {
          setSrc(fallbackSrc);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

export function WorClassIcon({ classKey }: { classKey: string }) {
  const key = classKey as HeroClassKey;
  const label = CLASS_DISPLAY_NAMES[key] ?? classKey;
  if (!(HERO_CLASSES as readonly string[]).includes(key)) {
    return <span className="text-muted">—</span>;
  }
  const urls = worClassIconUrls(key);
  return (
    <WorIconWithFallback
      className="invert-on-light"
      primarySrc={urls.primary}
      fallbackSrc={urls.fallback}
      alt={label}
    />
  );
}

export function WorFactionIcon({ factionKey }: { factionKey: string }) {
  const key = factionKey as FactionKey;
  const label = FACTION_DISPLAY_NAMES[key] ?? factionKey;
  if (key === 'unaffiliated') {
    return (
      <MaterialSymbol
        name="person_off"
        title={label}
        className="text-muted"
        style={{ fontSize: 28 }}
      />
    );
  }
  if (!(FACTIONS as readonly string[]).includes(key)) {
    return <span className="text-muted">—</span>;
  }
  const urls = worFactionIconUrls(key);
  return <WorIconWithFallback primarySrc={urls.primary} fallbackSrc={urls.fallback} alt={label} />;
}

export function WorFactionIcons({
  primary,
  secondary,
}: {
  primary: string;
  secondary?: string | null;
}) {
  if (!secondary || secondary === primary) {
    return <WorFactionIcon factionKey={primary} />;
  }
  return (
    <span className="wor-faction-icons">
      <WorFactionIcon factionKey={primary} />
      <WorFactionIcon factionKey={secondary} />
    </span>
  );
}

export function WorArtifactUserCell({
  classKey,
  exclusiveHeroName,
  exclusiveHeroPortrait,
  isUniversal,
}: {
  classKey?: string | null;
  exclusiveHeroName?: string | null;
  exclusiveHeroPortrait?: string | null;
  isUniversal?: number;
}) {
  const showHeroPortrait =
    isUniversal === 0 && exclusiveHeroPortrait && exclusiveHeroPortrait.length > 0;
  if (showHeroPortrait) {
    const label = exclusiveHeroName ? `Exclusive to ${exclusiveHeroName}` : 'Hero exclusive';
    return (
      <img
        src={exclusiveHeroPortrait}
        alt={label}
        title={label}
        width={28}
        height={28}
        className="wor-artifact-hero-icon"
        loading="lazy"
      />
    );
  }
  if (classKey) {
    return <WorClassIcon classKey={classKey} />;
  }
  return <span className="text-muted">—</span>;
}

export function gaugeLabel(tab: WorTab, level: number): string {
  if (tab === 'heroes') return HERO_AWAKENING_LABELS[level] ?? `A${level}`;
  if (tab === 'artifacts') return `${level}\u2605`;
  return String(level);
}

export interface WorRowProps {
  tab: WorTab;
  name: string;
  portraitPath?: string | null;
  summonPool?: SummonPoolBadge | null;
  isLimited?: boolean;
  owned: number;
  gaugeLevel: number;
  gaugeMax: number;
  starRating?: number;
  starIconKey?: string;
  extraCells?: ReactNode;
  onToggleOwned: () => void;
  onCycleGauge: () => void;
}

export const WorRow = memo(function WorRow({
  tab,
  name,
  portraitPath,
  summonPool,
  isLimited,
  owned,
  gaugeLevel,
  gaugeMax,
  starRating,
  starIconKey,
  extraCells,
  onToggleOwned,
  onCycleGauge,
}: WorRowProps) {
  const gaugeDisabled = owned !== 1;
  return (
    <tr className={owned === 1 ? 'wor-completed-row' : undefined}>
      <td className="wor-portrait-cell">
        <WorPortrait
          portraitPath={portraitPath}
          name={name}
          summonPool={summonPool}
          isLimited={isLimited}
        />
      </td>
      <td className="item-name">{name}</td>
      {extraCells}
      <td className="stars-cell">{renderStars(starRating, starIconKey)}</td>
      <td className="status-cell">
        <div className="wor-action-cell">
          <button
            type="button"
            className={ownedButtonClass(owned, true)}
            onClick={onToggleOwned}
            aria-label={`Toggle owned for ${name}`}
          >
            {ownedDisplay(owned)}
          </button>
        </div>
      </td>
      <td className="level-cell">
        <div className="wor-action-cell">
          <button
            type="button"
            className="gauge-btn"
            style={{ color: GAUGE_COLORS[gaugeLevel] ?? GAUGE_COLORS[0] }}
            disabled={gaugeDisabled}
            onClick={onCycleGauge}
            aria-label={`Cycle progression for ${name}`}
          >
            {tab === 'artifacts' ? renderGauge(gaugeLevel, gaugeMax) : gaugeLabel(tab, gaugeLevel)}
          </button>
        </div>
      </td>
    </tr>
  );
});
