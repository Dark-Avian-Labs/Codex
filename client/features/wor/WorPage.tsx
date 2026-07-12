import {
  ARTIFACT_GAUGE_EMPTY,
  ARTIFACT_GAUGE_FILLED,
  ARTIFACT_PROMOTION_MAX,
  CLASS_DISPLAY_NAMES,
  FACTION_DISPLAY_NAMES,
  FACTIONS,
  GAUGE_COLORS,
  HERO_AWAKENING_LABELS,
  HERO_AWAKENING_MAX,
  HERO_CLASSES,
} from '@codex/game-wor/constants';
import type { FactionKey, HeroClassKey } from '@codex/game-wor/constants';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import { HeaderSearch } from '../../components/Layout/HeaderSearch';
import { useLayoutSlots } from '../../components/Layout/useLayoutSlots';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Modal } from '../../components/ui/Modal';
import { apiFetch } from '../../utils/api';

type WorTab = 'heroes' | 'artifacts' | 'demons';

type WorHero = {
  id: number;
  name: string;
  class: string;
  faction: string;
  star_rating?: number;
  owned: number;
  gauge_level: number;
  reference_tier?: string | null;
  portrait_path?: string | null;
};

type WorArtifact = {
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

type WorDemon = {
  id: number;
  name: string;
  star_rating?: number;
  owned: number;
  gauge_level: number;
  max_level: number;
  portrait_path?: string | null;
};

type WorAccount = {
  id: number;
  account_name: string;
  is_active?: number;
};

type WorStats = { total: number; owned: number; maxed: number };

const ICON_MODULES = import.meta.glob('../../../packages/games/wor/assets/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const ICONS: Record<string, string> = {};
for (const [assetPath, src] of Object.entries(ICON_MODULES)) {
  const file = assetPath.split('/').pop();
  if (!file) continue;
  ICONS[file.replace('.png', '')] = src;
}

const tableScrollStyle = { '--header-offset': '340px' } as CSSProperties;
const HIDE_COMPLETED_STORAGE_KEY = 'codex-wor-hide-completed';

function readHideCompletedPreference(): boolean {
  try {
    return localStorage.getItem(HIDE_COMPLETED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function applyHideCompleted<T extends { owned: number }>(
  rows: T[],
  search: string,
  hideCompleted: boolean,
): T[] {
  if (!hideCompleted || search.trim().length > 0) return rows;
  return rows.filter((row) => row.owned !== 1);
}

function renderStars(count?: number): string | ReactNode {
  if (!count || count <= 0) return '-';
  const iconSrc = ICONS[`star${count}`];
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

function renderGauge(level: number, max: number): string {
  return Array.from({ length: max + 1 }, (_, index) =>
    index <= level ? ARTIFACT_GAUGE_FILLED : ARTIFACT_GAUGE_EMPTY,
  ).join('');
}

function ownedButtonClass(owned: number, interactive: boolean): string {
  if (!interactive) {
    return owned
      ? 'status-btn helminth-btn yes cursor-default border-success/35 bg-success/10 text-success/80'
      : 'status-btn helminth-btn unavailable';
  }
  return owned ? 'status-btn helminth-btn yes' : 'status-btn helminth-btn empty';
}

function ownedDisplay(owned: number): string {
  return owned ? '\u2713' : '\u2014';
}

function isExclusiveArtifact(artifact: WorArtifact): boolean {
  return artifact.is_universal === 0 || Boolean(artifact.exclusive_hero_slug);
}

function WorPortrait({ portraitPath, name }: { portraitPath?: string | null; name: string }) {
  if (!portraitPath) {
    return <span className="wor-portrait-placeholder" aria-hidden="true" />;
  }
  return <img src={portraitPath} alt="" width={32} height={32} loading="lazy" title={name} />;
}

function worClassIconUrls(classKey: HeroClassKey): { primary: string; fallback: string } {
  if (classKey === 'tactician') {
    const path = '/wor-images/icons/classes/tactician.png';
    return { primary: path, fallback: path };
  }
  return {
    primary: `/wor-images/icons/classes/${classKey}.svg`,
    fallback: `/wor-images/icons/classes/${classKey}.png`,
  };
}

function worFactionIconUrls(factionKey: FactionKey): { primary: string; fallback: string } {
  return {
    primary: `/wor-images/icons/factions/${factionKey}.svg`,
    fallback: `/wor-images/icons/factions/${factionKey}.png`,
  };
}

function WorIconWithFallback({
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
  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      title={alt}
      width={size}
      height={size}
      onError={() => {
        if (src !== fallbackSrc) setSrc(fallbackSrc);
      }}
    />
  );
}

function WorClassIcon({ classKey }: { classKey: string }) {
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

function WorFactionIcon({ factionKey }: { factionKey: string }) {
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
  return (
    <WorIconWithFallback
      primarySrc={worFactionIconUrls(key).primary}
      fallbackSrc={worFactionIconUrls(key).fallback}
      alt={label}
    />
  );
}

function WorArtifactUserCell({
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

function gaugeLabel(tab: WorTab, level: number): string {
  if (tab === 'heroes') return HERO_AWAKENING_LABELS[level] ?? `A${level}`;
  if (tab === 'artifacts') return `${level}\u2605`;
  return String(level);
}

interface WorRowProps {
  tab: WorTab;
  name: string;
  portraitPath?: string | null;
  owned: number;
  gaugeLevel: number;
  gaugeMax: number;
  starRating?: number;
  extraCells?: ReactNode;
  onToggleOwned: () => void;
  onCycleGauge: () => void;
}

const WorRow = memo(function WorRow({
  tab,
  name,
  portraitPath,
  owned,
  gaugeLevel,
  gaugeMax,
  starRating,
  extraCells,
  onToggleOwned,
  onCycleGauge,
}: WorRowProps) {
  const gaugeDisabled = owned !== 1;
  return (
    <tr className={owned === 1 ? 'wor-completed-row' : undefined}>
      <td className="wor-portrait-cell">
        <WorPortrait portraitPath={portraitPath} name={name} />
      </td>
      <td className="item-name">{name}</td>
      {extraCells}
      <td className="stars-cell">{renderStars(starRating)}</td>
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

export function WorPage() {
  const { setHeaderCenter, setHeaderActions } = useLayoutSlots();
  const [tab, setTab] = useState<WorTab>('heroes');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<HeroClassKey | null>(null);
  const [factionFilter, setFactionFilter] = useState<FactionKey | null>(null);
  const [exclusiveFilter, setExclusiveFilter] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(readHideCompletedPreference);
  const [heroes, setHeroes] = useState<WorHero[]>([]);
  const [artifacts, setArtifacts] = useState<WorArtifact[]>([]);
  const [demons, setDemons] = useState<WorDemon[]>([]);
  const [accounts, setAccounts] = useState<WorAccount[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<number | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountNameDraft, setAccountNameDraft] = useState('');
  const [accountEditId, setAccountEditId] = useState<number | null>(null);
  const [accountEditDraft, setAccountEditDraft] = useState('');
  const [deleteAccount, setDeleteAccount] = useState<WorAccount | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const handleActionError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : 'Request failed');
  }, []);

  const currentAccount = useMemo(
    () => accounts.find((account) => account.id === currentAccountId) ?? null,
    [accounts, currentAccountId],
  );

  const closeAccountModal = useCallback(() => {
    setAccountModalOpen(false);
    setAccountNameDraft('');
    setAccountEditId(null);
    setAccountEditDraft('');
  }, []);

  const loadAccounts = useCallback(async () => {
    const response = await apiFetch('/api/wor/accounts');
    if (!response.ok) throw new Error('Failed to load accounts');
    const body = (await response.json()) as {
      accounts?: WorAccount[];
      current_account_id?: number | null;
    };
    setAccounts(Array.isArray(body.accounts) ? body.accounts : []);
    setCurrentAccountId(body.current_account_id ?? null);
  }, []);

  const loadTabData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadAccounts();
      const params = new URLSearchParams();
      if (tab === 'heroes') {
        if (classFilter) params.set('class', classFilter);
        if (factionFilter) params.set('faction', factionFilter);
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await apiFetch(`/api/wor/${tab}${suffix}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Failed to load collection');
      }
      const body = (await response.json()) as {
        heroes?: WorHero[];
        artifacts?: WorArtifact[];
        demons?: WorDemon[];
      };
      if (tab === 'heroes') setHeroes(body.heroes ?? []);
      if (tab === 'artifacts') setArtifacts(body.artifacts ?? []);
      if (tab === 'demons') setDemons(body.demons ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [classFilter, factionFilter, loadAccounts, tab]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  useEffect(() => {
    setHeaderCenter(
      <HeaderSearch
        inputId="codex-wor-search"
        value={search}
        onChange={setSearch}
        ariaLabel="Search Watcher of Realms collection"
        placeholder="Search..."
      />,
    );
    return () => setHeaderCenter(null);
  }, [search, setHeaderCenter]);

  const filteredHeroes = useMemo(
    () => heroes.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())),
    [heroes, search],
  );
  const filteredArtifacts = useMemo(
    () =>
      artifacts.filter((row) => {
        if (!row.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (classFilter && row.class !== classFilter) return false;
        if (exclusiveFilter && !isExclusiveArtifact(row)) return false;
        return true;
      }),
    [artifacts, search, classFilter, exclusiveFilter],
  );
  const filteredDemons = useMemo(
    () => demons.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())),
    [demons, search],
  );

  const visibleHeroes = useMemo(
    () => applyHideCompleted(filteredHeroes, search, hideCompleted),
    [filteredHeroes, hideCompleted, search],
  );
  const visibleArtifacts = useMemo(
    () => applyHideCompleted(filteredArtifacts, search, hideCompleted),
    [filteredArtifacts, hideCompleted, search],
  );
  const visibleDemons = useMemo(
    () => applyHideCompleted(filteredDemons, search, hideCompleted),
    [filteredDemons, hideCompleted, search],
  );

  const handleHideCompletedChange = useCallback((nextValue: boolean) => {
    setHideCompleted(nextValue);
    try {
      localStorage.setItem(HIDE_COMPLETED_STORAGE_KEY, nextValue ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }, []);

  const stats = useMemo((): WorStats => {
    const rows = tab === 'heroes' ? heroes : tab === 'artifacts' ? artifacts : demons;
    const owned = rows.filter((row) => row.owned === 1).length;
    const maxed = rows.filter((row) => {
      if (row.owned !== 1) return false;
      if (tab === 'heroes') return row.gauge_level === HERO_AWAKENING_MAX;
      if (tab === 'artifacts') return row.gauge_level === ARTIFACT_PROMOTION_MAX;
      return row.gauge_level === (row as WorDemon).max_level;
    }).length;
    return { total: rows.length, owned, maxed };
  }, [artifacts, demons, heroes, tab]);

  const switchAccount = useCallback(
    async (accountId: number) => {
      if (currentAccountId === accountId) return;
      const response = await apiFetch('/api/wor/accounts/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      if (!response.ok) throw new Error('Failed to switch account');
      await loadTabData();
    },
    [currentAccountId, loadTabData],
  );

  const createAccount = useCallback(async () => {
    const name = accountNameDraft.trim();
    if (!name) return;
    const response = await apiFetch('/api/wor/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_name: name }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to create account');
    }
    setAccountNameDraft('');
    await loadTabData();
  }, [accountNameDraft, loadTabData]);

  const renameAccount = useCallback(
    async (accountId: number) => {
      const nextName = accountEditDraft.trim();
      if (!nextName) return;
      const response = await apiFetch(`/api/wor/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, account_name: nextName }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Failed to rename account');
      }
      setAccountEditId(null);
      setAccountEditDraft('');
      await loadTabData();
    },
    [accountEditDraft, loadTabData],
  );

  const confirmDeleteAccount = useCallback(async () => {
    if (!deleteAccount) return;
    const response = await apiFetch(`/api/wor/accounts/${deleteAccount.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: deleteAccount.id }),
    });
    if (!response.ok) throw new Error('Failed to delete account');
    if (accountEditId === deleteAccount.id) {
      setAccountEditId(null);
      setAccountEditDraft('');
    }
    setDeleteAccount(null);
    await loadTabData();
  }, [accountEditId, deleteAccount, loadTabData]);

  const openDeleteAccountModal = useCallback((account: WorAccount) => {
    setDeleteAccount(account);
  }, []);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return undefined;
    }

    const closeMenu = () => setIsAccountMenuOpen(false);
    const onPointerDown = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        event.target instanceof Node &&
        !accountMenuRef.current.contains(event.target)
      ) {
        closeMenu();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <div className="account-selector" ref={accountMenuRef}>
          <button
            id="wor-account-select"
            type="button"
            className="account-btn"
            aria-label="Select Watcher of Realms account"
            aria-haspopup="listbox"
            aria-expanded={isAccountMenuOpen}
            aria-controls="wor-account-listbox"
            onClick={() => setIsAccountMenuOpen((previous) => !previous)}
          >
            {currentAccount?.account_name ?? 'No account'}
          </button>
          <div
            id="wor-account-listbox"
            className={`account-dropdown ${isAccountMenuOpen ? 'show' : ''}`}
            role="listbox"
            aria-label="Watcher of Realms accounts"
          >
            {accounts.length === 0 ? (
              <div className="account-dropdown-item muted" role="option">
                No account
              </div>
            ) : (
              accounts.map((account) => {
                const isActive = account.id === currentAccountId;
                return (
                  <button
                    key={account.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`account-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      if (!isActive) {
                        void switchAccount(account.id).catch(handleActionError);
                      }
                    }}
                  >
                    {isActive ? (
                      <MaterialSymbol name="arrow_left_alt" style={{ fontSize: 18 }} />
                    ) : null}
                    <span>{account.account_name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <button type="button" className="header-link" onClick={() => setAccountModalOpen(true)}>
          Game Accounts
        </button>
      </div>,
    );
    return () => {
      setHeaderActions(null);
    };
  }, [
    accounts,
    currentAccount,
    currentAccountId,
    handleActionError,
    isAccountMenuOpen,
    setHeaderActions,
    switchAccount,
  ]);

  const patchOwned = useCallback(
    async (entity: 'heroes' | 'artifacts' | 'demons', id: number, nextOwned: number) => {
      type OwnedRow = { id: number; owned: number; gauge_level: number };
      let previousRow: OwnedRow | undefined;

      const apply = <T extends OwnedRow>(setter: Dispatch<SetStateAction<T[]>>) => {
        setter((previous) => {
          previousRow = previous.find((row) => row.id === id);
          return previous.map((row) =>
            row.id === id
              ? { ...row, owned: nextOwned, gauge_level: nextOwned === 0 ? 0 : row.gauge_level }
              : row,
          );
        });
      };

      if (entity === 'heroes') apply(setHeroes);
      else if (entity === 'artifacts') apply(setArtifacts);
      else apply(setDemons);

      try {
        const response = await apiFetch(`/api/wor/${entity}/${id}/owned`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owned: nextOwned }),
        });
        if (!response.ok) throw new Error('Failed to update owned status');
      } catch (err) {
        const rollback = <T extends OwnedRow>(setter: Dispatch<SetStateAction<T[]>>) => {
          if (!previousRow) return;
          setter((current) =>
            current.map((row) =>
              row.id === id
                ? {
                    ...row,
                    owned: previousRow!.owned,
                    gauge_level: previousRow!.gauge_level,
                  }
                : row,
            ),
          );
        };
        if (entity === 'heroes') rollback(setHeroes);
        else if (entity === 'artifacts') rollback(setArtifacts);
        else rollback(setDemons);
        handleActionError(err);
      }
    },
    [handleActionError],
  );

  const patchGauge = useCallback(
    async (
      entity: 'heroes' | 'artifacts' | 'demons',
      id: number,
      gaugeLevel: number,
      bodyKey: 'hero_id' | 'artifact_id' | 'demon_id',
    ) => {
      type GaugeRow = { id: number; owned: number; gauge_level: number };
      let previousRow: GaugeRow | undefined;

      const apply = <T extends GaugeRow>(setter: Dispatch<SetStateAction<T[]>>) => {
        setter((previous) => {
          previousRow = previous.find((row) => row.id === id);
          return previous.map((row) =>
            row.id === id ? { ...row, gauge_level: gaugeLevel, owned: 1 } : row,
          );
        });
      };

      if (entity === 'heroes') apply(setHeroes);
      else if (entity === 'artifacts') apply(setArtifacts);
      else apply(setDemons);

      try {
        const response = await apiFetch(`/api/wor/${entity}/${id}/gauge`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [bodyKey]: id, gauge_level: gaugeLevel }),
        });
        if (!response.ok) throw new Error('Failed to update gauge');
      } catch (err) {
        const rollback = <T extends GaugeRow>(setter: Dispatch<SetStateAction<T[]>>) => {
          if (!previousRow) return;
          setter((current) =>
            current.map((row) =>
              row.id === id
                ? {
                    ...row,
                    owned: previousRow!.owned,
                    gauge_level: previousRow!.gauge_level,
                  }
                : row,
            ),
          );
        };
        if (entity === 'heroes') rollback(setHeroes);
        else if (entity === 'artifacts') rollback(setArtifacts);
        else rollback(setDemons);
        handleActionError(err);
      }
    },
    [handleActionError],
  );

  return (
    <section className="space-y-4">
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="tabs" role="tablist" aria-label="WoR collection tabs">
        {(['heroes', 'artifacts', 'demons'] as const).map((item) => (
          <button
            key={item}
            id={`wor-tab-${item}`}
            type="button"
            role="tab"
            className={`tab ${tab === item ? 'active' : ''}`}
            aria-selected={tab === item}
            aria-controls="wor-panel"
            onClick={() => setTab(item)}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      <div id="wor-panel" role="tabpanel" aria-labelledby={`wor-tab-${tab}`}>
        {tab === 'heroes' ? (
          <div className="filter-bar" id="wor-filter-bar">
            <div className="filter-group">
              <span className="filter-label">Class:</span>
              {HERO_CLASSES.map((heroClass) => (
                <button
                  key={heroClass}
                  type="button"
                  className={`filter-icon ${classFilter === heroClass ? 'active' : ''}`}
                  title={CLASS_DISPLAY_NAMES[heroClass]}
                  aria-pressed={classFilter === heroClass}
                  aria-label={`Filter by ${CLASS_DISPLAY_NAMES[heroClass]} class`}
                  onClick={() =>
                    setClassFilter((previous) => (previous === heroClass ? null : heroClass))
                  }
                >
                  <WorIconWithFallback
                    className="invert-on-light"
                    primarySrc={worClassIconUrls(heroClass).primary}
                    fallbackSrc={worClassIconUrls(heroClass).fallback}
                    alt={CLASS_DISPLAY_NAMES[heroClass]}
                    size={24}
                  />
                </button>
              ))}
            </div>
            <div className="filter-group">
              <span className="filter-label">Faction:</span>
              {FACTIONS.map((faction) => (
                <button
                  key={faction}
                  type="button"
                  className={`filter-icon ${factionFilter === faction ? 'active' : ''}`}
                  title={FACTION_DISPLAY_NAMES[faction]}
                  aria-pressed={factionFilter === faction}
                  aria-label={`Filter by ${FACTION_DISPLAY_NAMES[faction]} faction`}
                  onClick={() =>
                    setFactionFilter((previous) => (previous === faction ? null : faction))
                  }
                >
                  {faction === 'unaffiliated' ? (
                    <MaterialSymbol
                      name="person_off"
                      className="text-muted"
                      style={{ fontSize: 24 }}
                    />
                  ) : (
                    <WorIconWithFallback
                      primarySrc={worFactionIconUrls(faction).primary}
                      fallbackSrc={worFactionIconUrls(faction).fallback}
                      alt={FACTION_DISPLAY_NAMES[faction]}
                      size={24}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : tab === 'artifacts' ? (
          <div className="filter-bar" id="wor-artifact-filter-bar">
            <div className="filter-group">
              <span className="filter-label">Class:</span>
              {HERO_CLASSES.map((heroClass) => (
                <button
                  key={heroClass}
                  type="button"
                  className={`filter-icon ${classFilter === heroClass ? 'active' : ''}`}
                  title={CLASS_DISPLAY_NAMES[heroClass]}
                  aria-pressed={classFilter === heroClass}
                  aria-label={`Filter by ${CLASS_DISPLAY_NAMES[heroClass]} class`}
                  onClick={() =>
                    setClassFilter((previous) => (previous === heroClass ? null : heroClass))
                  }
                >
                  <WorIconWithFallback
                    className="invert-on-light"
                    primarySrc={worClassIconUrls(heroClass).primary}
                    fallbackSrc={worClassIconUrls(heroClass).fallback}
                    alt={CLASS_DISPLAY_NAMES[heroClass]}
                    size={24}
                  />
                </button>
              ))}
            </div>
            <div className="filter-group">
              <span className="filter-label">Exclusive:</span>
              <button
                type="button"
                className={`filter-icon ${exclusiveFilter ? 'active' : ''}`}
                title="Hero exclusive artifacts"
                aria-pressed={exclusiveFilter}
                aria-label="Filter hero exclusive artifacts"
                onClick={() => setExclusiveFilter((previous) => !previous)}
              >
                <MaterialSymbol name="crown" style={{ fontSize: 24 }} />
              </button>
            </div>
          </div>
        ) : null}

        <div className="stats-bar">
          <div className="stats-bar-stats">
            <div className="stat">
              <span>Total:</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat">
              <span>Owned:</span>
              <span className="stat-value stat-owned">{stats.owned}</span>
            </div>
            <div className="stat">
              <span>Maxed:</span>
              <span className="stat-value stat-maxed">{stats.maxed}</span>
            </div>
          </div>
          <div className="stats-bar-actions">
            <button
              type="button"
              onClick={() => handleHideCompletedChange(!hideCompleted)}
              aria-pressed={hideCompleted}
              className="border-glass-border text-muted hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-[color,background-color,border-color,box-shadow] duration-200"
              title='Toggle "Hide completed"'
            >
              <span>Hide completed</span>
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition-colors ${
                  hideCompleted
                    ? 'bg-success/20 text-success hover:bg-success/30'
                    : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
                }`}
                aria-hidden="true"
              >
                {hideCompleted ? (
                  <MaterialSymbol
                    name="check"
                    filled
                    className="leading-none"
                    style={{ fontSize: 15 }}
                  />
                ) : (
                  <MaterialSymbol name="close" className="leading-none" style={{ fontSize: 15 }} />
                )}
              </span>
            </button>
          </div>
        </div>

        <div className="table-container" aria-busy={loading}>
          <div className={`table-scroll ${loading ? 'opacity-60' : ''}`} style={tableScrollStyle}>
            <table className="wor-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="wor-portrait-cell" aria-label="Portrait" />
                  <th>Name</th>
                  {tab === 'heroes' ? (
                    <>
                      <th className="icon-cell text-center">Class</th>
                      <th className="icon-cell text-center">Faction</th>
                    </>
                  ) : tab === 'artifacts' ? (
                    <th className="icon-cell text-center">Class</th>
                  ) : null}
                  <th>Rarity</th>
                  <th className="status-cell">Owned</th>
                  <th className="level-cell">
                    {tab === 'heroes' ? 'Awakening' : tab === 'artifacts' ? 'Promotion' : 'Level'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={tab === 'heroes' ? 7 : tab === 'artifacts' ? 6 : 5}
                      className="text-muted text-center"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : tab === 'heroes' ? (
                  visibleHeroes.map((hero) => (
                    <WorRow
                      key={hero.id}
                      tab="heroes"
                      name={hero.name}
                      portraitPath={hero.portrait_path}
                      owned={hero.owned}
                      gaugeLevel={hero.gauge_level}
                      gaugeMax={HERO_AWAKENING_MAX}
                      starRating={hero.star_rating}
                      extraCells={
                        <>
                          <td className="icon-cell">
                            <WorClassIcon classKey={hero.class} />
                          </td>
                          <td className="icon-cell">
                            <WorFactionIcon factionKey={hero.faction} />
                          </td>
                        </>
                      }
                      onToggleOwned={() =>
                        void patchOwned('heroes', hero.id, hero.owned ? 0 : 1).catch(
                          handleActionError,
                        )
                      }
                      onCycleGauge={() => {
                        if (hero.owned !== 1) return;
                        const next =
                          hero.gauge_level >= HERO_AWAKENING_MAX ? 0 : hero.gauge_level + 1;
                        void patchGauge('heroes', hero.id, next, 'hero_id').catch(
                          handleActionError,
                        );
                      }}
                    />
                  ))
                ) : tab === 'artifacts' ? (
                  visibleArtifacts.map((artifact) => (
                    <WorRow
                      key={artifact.id}
                      tab="artifacts"
                      name={artifact.name}
                      portraitPath={artifact.portrait_path}
                      owned={artifact.owned}
                      gaugeLevel={artifact.gauge_level}
                      gaugeMax={ARTIFACT_PROMOTION_MAX}
                      starRating={artifact.star_rating}
                      extraCells={
                        <td className="icon-cell">
                          <WorArtifactUserCell
                            classKey={artifact.class}
                            exclusiveHeroName={artifact.exclusive_hero_name}
                            exclusiveHeroPortrait={artifact.exclusive_hero_portrait}
                            isUniversal={artifact.is_universal}
                          />
                        </td>
                      }
                      onToggleOwned={() =>
                        void patchOwned('artifacts', artifact.id, artifact.owned ? 0 : 1).catch(
                          handleActionError,
                        )
                      }
                      onCycleGauge={() => {
                        if (artifact.owned !== 1) return;
                        const next =
                          artifact.gauge_level >= ARTIFACT_PROMOTION_MAX
                            ? 0
                            : artifact.gauge_level + 1;
                        void patchGauge('artifacts', artifact.id, next, 'artifact_id').catch(
                          handleActionError,
                        );
                      }}
                    />
                  ))
                ) : (
                  visibleDemons.map((demon) => (
                    <WorRow
                      key={demon.id}
                      tab="demons"
                      name={demon.name}
                      portraitPath={demon.portrait_path}
                      owned={demon.owned}
                      gaugeLevel={demon.gauge_level}
                      gaugeMax={demon.max_level}
                      starRating={demon.star_rating}
                      onToggleOwned={() =>
                        void patchOwned('demons', demon.id, demon.owned ? 0 : 1).catch(
                          handleActionError,
                        )
                      }
                      onCycleGauge={() => {
                        if (demon.owned !== 1) return;
                        const next =
                          demon.gauge_level >= demon.max_level ? 0 : demon.gauge_level + 1;
                        void patchGauge('demons', demon.id, next, 'demon_id').catch(
                          handleActionError,
                        );
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={accountModalOpen}
        onClose={closeAccountModal}
        ariaLabelledBy="wor-account-modal-title"
        className="glass-modal-surface max-w-lg p-6"
      >
        <h2 id="wor-account-modal-title" className="mb-4 text-lg font-semibold">
          Game Accounts
        </h2>
        <div className="account-manager-list">
          {accounts.length === 0 ? (
            <p className="text-muted text-sm">No accounts yet.</p>
          ) : (
            accounts.map((account) => {
              const isEditing = accountEditId === account.id;
              const isActive = currentAccountId === account.id;
              return (
                <div key={account.id} className="account-manager-row">
                  {isEditing ? (
                    <input
                      id={`codex-wor-account-edit-${account.id}`}
                      value={accountEditDraft}
                      onChange={(event) => setAccountEditDraft(event.target.value)}
                      aria-label={`Edit name for ${account.account_name}`}
                    />
                  ) : (
                    <div className="account-manager-name">
                      <span>{account.account_name}</span>
                      {isActive ? <span className="account-manager-active">Active</span> : null}
                    </div>
                  )}
                  <div className="account-manager-actions">
                    {!isEditing && !isActive ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void switchAccount(account.id).catch(handleActionError)}
                      >
                        Use
                      </button>
                    ) : null}
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-accent"
                          onClick={() => void renameAccount(account.id).catch(handleActionError)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-cancel"
                          onClick={() => {
                            setAccountEditId(null);
                            setAccountEditDraft('');
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setAccountEditId(account.id);
                            setAccountEditDraft(account.account_name);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => openDeleteAccountModal(account)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="form-group">
          <label htmlFor="wor-account-name">Account name</label>
          <input
            id="wor-account-name"
            className="form-input"
            value={accountNameDraft}
            onChange={(event) => setAccountNameDraft(event.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-cancel" onClick={closeAccountModal}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => void createAccount().catch(handleActionError)}
          >
            Add Account
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteAccount !== null}
        title="Delete account?"
        message={
          deleteAccount
            ? `Delete "${deleteAccount.account_name}" and all collection progress on this account?`
            : ''
        }
        confirmLabel="Delete"
        onCancel={() => setDeleteAccount(null)}
        onConfirm={() => void confirmDeleteAccount().catch(handleActionError)}
      />
    </section>
  );
}
