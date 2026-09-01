import {
  ARTIFACT_FILTER_STAR_RATINGS,
  ARTIFACT_PROMOTION_MAX,
  CLASS_DISPLAY_NAMES,
  DEMON_LEVEL_MIN,
  FACTION_DISPLAY_NAMES,
  FACTIONS,
  FILTER_STAR_RARITY_LABELS,
  FILTER_STAR_RATINGS,
  HERO_AWAKENING_MAX,
  HERO_CLASSES,
} from '@codex/game-wor/constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CollectionSubheader } from '../../components/Layout/CollectionSubheader';
import { HeaderSearch } from '../../components/Layout/HeaderSearch';
import { useLayoutSlots } from '../../components/Layout/useLayoutSlots';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { FilterIconButton } from '../../components/ui/FilterIconButton';
import { LoadErrorBanner } from '../../components/ui/LoadErrorBanner';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Modal } from '../../components/ui/Modal';
import { Toast } from '../../components/ui/Toast';
import { useAutoDismissMessage } from '../../hooks/useAutoDismissMessage';
import {
  cycleTriFilter,
  cycleTriState,
  matchesAnyTriFilter,
  matchesBoolTri,
  matchesTriFilter,
  pruneTriFilter,
  triFilterState,
  type FilterTriState,
  type TriFilterMap,
} from '../../lib/triFilter';
import { apiFetch } from '../../utils/api';
import {
  HIDE_COMPLETED_STORAGE_KEY,
  ICONS,
  WorArtifactUserCell,
  WorClassIcon,
  WorFactionIcons,
  WorIconWithFallback,
  WorRow,
  applyHideCompleted,
  gaugeAfterOwnedToggle,
  isExclusiveArtifact,
  isRedStarDemon,
  isRedStarHero,
  readHideCompletedPreference,
  summonPoolBadge,
  worClassIconUrls,
  worFactionIconUrls,
  type WorAccount,
  type WorArtifact,
  type WorDemon,
  type WorHero,
  type WorStats,
  type WorTab,
} from './worPageSupport';

export function WorPage() {
  const { setHeaderCenter, setHeaderActions } = useLayoutSlots();
  const [tab, setTab] = useState<WorTab>('heroes');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<TriFilterMap>({});
  const [factionFilter, setFactionFilter] = useState<TriFilterMap>({});
  const [rarityFilter, setRarityFilter] = useState<TriFilterMap>({});
  const [redStarFilter, setRedStarFilter] = useState<FilterTriState>('off');
  const [exclusiveFilter, setExclusiveFilter] = useState<FilterTriState>('off');
  const [hideCompleted, setHideCompleted] = useState(readHideCompletedPreference);
  const [heroes, setHeroes] = useState<WorHero[]>([]);
  const [artifacts, setArtifacts] = useState<WorArtifact[]>([]);
  const [demons, setDemons] = useState<WorDemon[]>([]);
  const [accounts, setAccounts] = useState<WorAccount[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<number | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountNameDraft, setAccountNameDraft] = useState('');
  const [accountEditId, setAccountEditId] = useState<number | null>(null);
  const [accountEditDraft, setAccountEditDraft] = useState('');
  const [deleteAccount, setDeleteAccount] = useState<WorAccount | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const heroesRef = useRef(heroes);
  const artifactsRef = useRef(artifacts);
  const demonsRef = useRef(demons);
  heroesRef.current = heroes;
  artifactsRef.current = artifacts;
  demonsRef.current = demons;

  const handleActionError = useCallback((err: unknown) => {
    setOperationError(err instanceof Error ? err.message : 'Request failed');
  }, []);
  const clearOperationError = useCallback(() => {
    setOperationError(null);
  }, []);
  useAutoDismissMessage(operationError, clearOperationError);

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
    setLoadError(null);
    try {
      await loadAccounts();
      const response = await apiFetch(`/api/wor/${tab}`);
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
      setLoadError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [loadAccounts, tab]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  useEffect(() => {
    const allowed = (tab === 'artifacts' ? ARTIFACT_FILTER_STAR_RATINGS : FILTER_STAR_RATINGS).map(
      (stars) => String(stars),
    );
    setRarityFilter((previous) => pruneTriFilter(previous, allowed));
    if (tab === 'artifacts' && redStarFilter !== 'off') {
      setRedStarFilter('off');
    }
  }, [redStarFilter, tab]);

  useEffect(() => {
    setHeaderCenter(
      <HeaderSearch
        inputId="codex-wor-search"
        value=""
        onChange={setSearch}
        ariaLabel="Search Watcher of Realms collection"
        placeholder="Search..."
      />,
    );
    return () => setHeaderCenter(null);
  }, [setHeaderCenter]);

  const filteredHeroes = useMemo(
    () =>
      heroes.filter((row) => {
        if (!row.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (!matchesTriFilter(row.class, classFilter)) return false;
        if (!matchesAnyTriFilter([row.faction, row.faction_secondary], factionFilter)) return false;
        if (!matchesTriFilter(row.star_rating, rarityFilter)) return false;
        if (!matchesBoolTri(isRedStarHero(row), redStarFilter)) return false;
        return true;
      }),
    [heroes, classFilter, factionFilter, rarityFilter, redStarFilter, search],
  );
  const filteredArtifacts = useMemo(
    () =>
      artifacts.filter((row) => {
        if (!row.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (!matchesTriFilter(row.class, classFilter)) return false;
        if (!matchesTriFilter(row.star_rating, rarityFilter)) return false;
        if (!matchesBoolTri(isExclusiveArtifact(row), exclusiveFilter)) return false;
        return true;
      }),
    [artifacts, search, classFilter, exclusiveFilter, rarityFilter],
  );
  const filteredDemons = useMemo(
    () =>
      demons.filter((row) => {
        if (!row.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (!matchesTriFilter(row.star_rating, rarityFilter)) return false;
        if (!matchesBoolTri(isRedStarDemon(row), redStarFilter)) return false;
        return true;
      }),
    [demons, search, rarityFilter, redStarFilter],
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
    const rows =
      tab === 'heroes' ? filteredHeroes : tab === 'artifacts' ? filteredArtifacts : filteredDemons;
    const owned = rows.filter((row) => row.owned === 1).length;
    const maxed = rows.filter((row) => {
      if (row.owned !== 1) return false;
      if (tab === 'heroes') return row.gauge_level === HERO_AWAKENING_MAX;
      if (tab === 'artifacts') return row.gauge_level === ARTIFACT_PROMOTION_MAX;
      return row.gauge_level === (row as WorDemon).max_level;
    }).length;
    return { total: rows.length, owned, maxed };
  }, [filteredArtifacts, filteredDemons, filteredHeroes, tab]);

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
      const sourceRef =
        entity === 'heroes' ? heroesRef : entity === 'artifacts' ? artifactsRef : demonsRef;
      const previousRow = sourceRef.current.find((row) => row.id === id);
      const nextRows = sourceRef.current.map((row) =>
        row.id === id
          ? {
              ...row,
              owned: nextOwned,
              gauge_level: gaugeAfterOwnedToggle(entity, row.gauge_level, nextOwned),
            }
          : row,
      );
      sourceRef.current = nextRows;

      if (entity === 'heroes') setHeroes(nextRows as WorHero[]);
      else if (entity === 'artifacts') setArtifacts(nextRows as WorArtifact[]);
      else setDemons(nextRows as WorDemon[]);

      try {
        const response = await apiFetch(`/api/wor/${entity}/${id}/owned`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owned: nextOwned }),
        });
        if (!response.ok) throw new Error('Failed to update owned status');
      } catch (err) {
        if (previousRow) {
          const rollbackRows = sourceRef.current.map((row) =>
            row.id === id
              ? {
                  ...row,
                  owned: previousRow.owned,
                  gauge_level: previousRow.gauge_level,
                }
              : row,
          );
          sourceRef.current = rollbackRows;
          if (entity === 'heroes') setHeroes(rollbackRows as WorHero[]);
          else if (entity === 'artifacts') setArtifacts(rollbackRows as WorArtifact[]);
          else setDemons(rollbackRows as WorDemon[]);
        }
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
      const sourceRef =
        entity === 'heroes' ? heroesRef : entity === 'artifacts' ? artifactsRef : demonsRef;
      const previousRow = sourceRef.current.find((row) => row.id === id);
      const nextRows = sourceRef.current.map((row) =>
        row.id === id ? { ...row, gauge_level: gaugeLevel, owned: 1 } : row,
      );
      sourceRef.current = nextRows;

      if (entity === 'heroes') setHeroes(nextRows as WorHero[]);
      else if (entity === 'artifacts') setArtifacts(nextRows as WorArtifact[]);
      else setDemons(nextRows as WorDemon[]);

      try {
        const response = await apiFetch(`/api/wor/${entity}/${id}/gauge`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [bodyKey]: id, gauge_level: gaugeLevel }),
        });
        if (!response.ok) throw new Error('Failed to update gauge');
      } catch (err) {
        if (previousRow) {
          const rollbackRows = sourceRef.current.map((row) =>
            row.id === id
              ? {
                  ...row,
                  owned: previousRow.owned,
                  gauge_level: previousRow.gauge_level,
                }
              : row,
          );
          sourceRef.current = rollbackRows;
          if (entity === 'heroes') setHeroes(rollbackRows as WorHero[]);
          else if (entity === 'artifacts') setArtifacts(rollbackRows as WorArtifact[]);
          else setDemons(rollbackRows as WorDemon[]);
        }
        handleActionError(err);
      }
    },
    [handleActionError],
  );

  return (
    <section className="collection-view">
      {loadError ? (
        <LoadErrorBanner message={loadError} onRetry={() => void loadTabData()} />
      ) : null}
      <Toast message={operationError} tone="error" onDismiss={clearOperationError} />

      <CollectionSubheader>
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
        <div
          className="filter-bar"
          id={
            tab === 'heroes'
              ? 'wor-filter-bar'
              : tab === 'artifacts'
                ? 'wor-artifact-filter-bar'
                : 'wor-demon-filter-bar'
          }
        >
          {tab === 'heroes' || tab === 'artifacts' ? (
            <div className="filter-group">
              <span className="filter-label">Class:</span>
              {HERO_CLASSES.map((heroClass) => (
                <FilterIconButton
                  key={heroClass}
                  state={triFilterState(classFilter, heroClass)}
                  label={`${CLASS_DISPLAY_NAMES[heroClass]} class`}
                  onClick={() => setClassFilter((previous) => cycleTriFilter(previous, heroClass))}
                >
                  <WorIconWithFallback
                    className="invert-on-light"
                    primarySrc={worClassIconUrls(heroClass).primary}
                    fallbackSrc={worClassIconUrls(heroClass).fallback}
                    alt={CLASS_DISPLAY_NAMES[heroClass]}
                    size={24}
                  />
                </FilterIconButton>
              ))}
            </div>
          ) : null}
          <div className="filter-group">
            <span className="filter-label">Rarity:</span>
            {(tab === 'artifacts' ? ARTIFACT_FILTER_STAR_RATINGS : FILTER_STAR_RATINGS).map(
              (stars) => {
                const label = FILTER_STAR_RARITY_LABELS[stars];
                const iconSrc = ICONS[`star${stars}`];
                return (
                  <FilterIconButton
                    key={stars}
                    state={triFilterState(rarityFilter, String(stars))}
                    label={`${label} rarity`}
                    onClick={() =>
                      setRarityFilter((previous) => cycleTriFilter(previous, String(stars)))
                    }
                  >
                    {iconSrc ? (
                      <img src={iconSrc} alt={`${stars} star`} width={24} height={24} />
                    ) : (
                      <span aria-hidden="true">{stars}★</span>
                    )}
                  </FilterIconButton>
                );
              },
            )}
            {tab === 'heroes' || tab === 'demons' ? (
              <FilterIconButton
                state={redStarFilter}
                label={tab === 'heroes' ? 'Lord heroes' : 'Captain demons'}
                onClick={() => setRedStarFilter((previous) => cycleTriState(previous))}
              >
                {ICONS.star6 ? (
                  <img src={ICONS.star6} alt="Red star" width={24} height={24} />
                ) : (
                  <span aria-hidden="true">★</span>
                )}
              </FilterIconButton>
            ) : null}
          </div>
          {tab === 'heroes' ? (
            <div className="filter-group">
              <span className="filter-label">Faction:</span>
              {FACTIONS.map((faction) => {
                const urls = faction === 'unaffiliated' ? null : worFactionIconUrls(faction);
                return (
                  <FilterIconButton
                    key={faction}
                    state={triFilterState(factionFilter, faction)}
                    label={`${FACTION_DISPLAY_NAMES[faction]} faction`}
                    onClick={() =>
                      setFactionFilter((previous) => cycleTriFilter(previous, faction))
                    }
                  >
                    {faction === 'unaffiliated' || !urls ? (
                      <MaterialSymbol
                        name="person_off"
                        className="text-muted"
                        style={{ fontSize: 24 }}
                      />
                    ) : (
                      <WorIconWithFallback
                        primarySrc={urls.primary}
                        fallbackSrc={urls.fallback}
                        alt={FACTION_DISPLAY_NAMES[faction]}
                        size={24}
                      />
                    )}
                  </FilterIconButton>
                );
              })}
            </div>
          ) : tab === 'artifacts' ? (
            <div className="filter-group">
              <span className="filter-label">Exclusive:</span>
              <FilterIconButton
                state={exclusiveFilter}
                label="hero exclusive artifacts"
                onClick={() => setExclusiveFilter((previous) => cycleTriState(previous))}
              >
                <MaterialSymbol name="crown" style={{ fontSize: 24 }} />
              </FilterIconButton>
            </div>
          ) : null}
        </div>
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
              className="stats-bar-toggle"
              title='Toggle "Hide completed"'
            >
              <span>Hide completed</span>
              <span
                className={`stats-bar-toggle-indicator ${hideCompleted ? 'is-on' : ''}`}
                aria-hidden="true"
              >
                {hideCompleted ? (
                  <MaterialSymbol
                    name="check"
                    filled
                    className="leading-none"
                    style={{ fontSize: 14 }}
                  />
                ) : (
                  <MaterialSymbol name="close" className="leading-none" style={{ fontSize: 14 }} />
                )}
              </span>
            </button>
          </div>
        </div>
      </CollectionSubheader>

      <div id="wor-panel" role="tabpanel" aria-labelledby={`wor-tab-${tab}`}>
        <div className="table-container" aria-busy={loading}>
          <div className={`table-scroll ${loading ? 'opacity-60' : ''}`}>
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
                      summonPool={summonPoolBadge(hero)}
                      isLimited={Boolean(hero.is_limited)}
                      owned={hero.owned}
                      gaugeLevel={hero.gauge_level}
                      gaugeMax={HERO_AWAKENING_MAX}
                      starRating={hero.star_rating}
                      starIconKey={isRedStarHero(hero) ? 'star6' : undefined}
                      extraCells={
                        <>
                          <td className="icon-cell">
                            <WorClassIcon classKey={hero.class} />
                          </td>
                          <td className="icon-cell">
                            <WorFactionIcons
                              primary={hero.faction}
                              secondary={hero.faction_secondary}
                            />
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
                      starIconKey={isRedStarDemon(demon) ? 'star6' : undefined}
                      onToggleOwned={() =>
                        void patchOwned('demons', demon.id, demon.owned ? 0 : 1).catch(
                          handleActionError,
                        )
                      }
                      onCycleGauge={() => {
                        if (demon.owned !== 1) return;
                        const next =
                          demon.gauge_level >= demon.max_level
                            ? DEMON_LEVEL_MIN
                            : demon.gauge_level + 1;
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
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void createAccount().catch(handleActionError);
              }
            }}
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
