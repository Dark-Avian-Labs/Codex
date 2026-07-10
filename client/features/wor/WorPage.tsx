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
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { HeaderSearch } from '../../components/Layout/HeaderSearch';
import { useLayoutSlots } from '../../components/Layout/useLayoutSlots';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
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
};

type WorArtifact = {
  id: number;
  name: string;
  star_rating?: number;
  owned: number;
  gauge_level: number;
  reference_tier?: string | null;
};

type WorDemon = {
  id: number;
  name: string;
  star_rating?: number;
  owned: number;
  gauge_level: number;
  max_level: number;
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

function gaugeLabel(tab: WorTab, level: number): string {
  if (tab === 'heroes') return HERO_AWAKENING_LABELS[level] ?? `A${level}`;
  if (tab === 'artifacts') return `${level}\u2605`;
  return String(level);
}

interface WorRowProps {
  tab: WorTab;
  name: string;
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
    <tr>
      <td className="item-name">{name}</td>
      {extraCells}
      <td className="stars-cell">{renderStars(starRating)}</td>
      <td className="status-cell">
        <button
          type="button"
          className={ownedButtonClass(owned, true)}
          onClick={onToggleOwned}
          aria-label={`Toggle owned for ${name}`}
        >
          {ownedDisplay(owned)}
        </button>
      </td>
      <td className="level-cell">
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
      </td>
    </tr>
  );
});

export function WorPage() {
  const { setHeaderCenter } = useLayoutSlots();
  const [tab, setTab] = useState<WorTab>('heroes');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<HeroClassKey | null>(null);
  const [factionFilter, setFactionFilter] = useState<FactionKey | null>(null);
  const [heroes, setHeroes] = useState<WorHero[]>([]);
  const [artifacts, setArtifacts] = useState<WorArtifact[]>([]);
  const [demons, setDemons] = useState<WorDemon[]>([]);
  const [stats, setStats] = useState<WorStats>({ total: 0, owned: 0, maxed: 0 });
  const [accounts, setAccounts] = useState<WorAccount[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountNameDraft, setAccountNameDraft] = useState('');
  const [deleteAccount, setDeleteAccount] = useState<WorAccount | null>(null);

  const handleActionError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : 'Request failed');
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
        stats?: WorStats;
      };
      if (tab === 'heroes') setHeroes(body.heroes ?? []);
      if (tab === 'artifacts') setArtifacts(body.artifacts ?? []);
      if (tab === 'demons') setDemons(body.demons ?? []);
      setStats(body.stats ?? { total: 0, owned: 0, maxed: 0 });
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
    () => artifacts.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())),
    [artifacts, search],
  );
  const filteredDemons = useMemo(
    () => demons.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())),
    [demons, search],
  );

  const switchAccount = useCallback(
    async (accountId: number) => {
      const response = await apiFetch('/api/wor/accounts/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });
      if (!response.ok) throw new Error('Failed to switch account');
      setCurrentAccountId(accountId);
      await loadTabData();
    },
    [loadTabData],
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
    setAccountModalOpen(false);
    setAccountNameDraft('');
    await loadTabData();
  }, [accountNameDraft, loadTabData]);

  const confirmDeleteAccount = useCallback(async () => {
    if (!deleteAccount) return;
    const response = await apiFetch(`/api/wor/accounts/${deleteAccount.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: deleteAccount.id }),
    });
    if (!response.ok) throw new Error('Failed to delete account');
    setDeleteAccount(null);
    await loadTabData();
  }, [deleteAccount, loadTabData]);

  const patchOwned = useCallback(
    async (entity: 'heroes' | 'artifacts' | 'demons', id: number, owned: number) => {
      const response = await apiFetch(`/api/wor/${entity}/${id}/owned`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owned }),
      });
      if (!response.ok) throw new Error('Failed to update owned status');
      await loadTabData();
    },
    [loadTabData],
  );

  const patchGauge = useCallback(
    async (
      entity: 'heroes' | 'artifacts' | 'demons',
      id: number,
      gaugeLevel: number,
      bodyKey: 'hero_id' | 'artifact_id' | 'demon_id',
    ) => {
      const response = await apiFetch(`/api/wor/${entity}/${id}/gauge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: id, gauge_level: gaugeLevel }),
      });
      if (!response.ok) throw new Error('Failed to update gauge');
      await loadTabData();
    },
    [loadTabData],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Watcher of Realms</h1>
          <p className="text-muted text-sm">
            Total {stats.total} · Owned {stats.owned} · Maxed {stats.maxed}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-muted text-sm" htmlFor="wor-account-select">
            Account
          </label>
          <select
            id="wor-account-select"
            className="form-input min-w-[10rem]"
            value={currentAccountId ?? ''}
            onChange={(event) => {
              const id = Number(event.target.value);
              if (id > 0) void switchAccount(id).catch(handleActionError);
            }}
          >
            {accounts.length === 0 ? <option value="">No accounts</option> : null}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAccountModalOpen(true)}
          >
            Add account
          </button>
          {accounts.length > 0 ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                const current = accounts.find((a) => a.id === currentAccountId);
                if (current) setDeleteAccount(current);
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="tabs" role="tablist" aria-label="WoR collection tabs">
        {(['heroes', 'artifacts', 'demons'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            className={`tab ${tab === item ? 'active' : ''}`}
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'heroes' ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`filter-chip ${classFilter === null ? 'active' : ''}`}
            onClick={() => setClassFilter(null)}
          >
            All classes
          </button>
          {HERO_CLASSES.map((heroClass) => (
            <button
              key={heroClass}
              type="button"
              className={`filter-chip ${classFilter === heroClass ? 'active' : ''}`}
              onClick={() => setClassFilter(heroClass)}
            >
              {CLASS_DISPLAY_NAMES[heroClass]}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-[var(--color-glass-border)]" />
          <button
            type="button"
            className={`filter-chip ${factionFilter === null ? 'active' : ''}`}
            onClick={() => setFactionFilter(null)}
          >
            All factions
          </button>
          {FACTIONS.map((faction) => (
            <button
              key={faction}
              type="button"
              className={`filter-chip ${factionFilter === faction ? 'active' : ''}`}
              onClick={() => setFactionFilter(faction)}
            >
              {FACTION_DISPLAY_NAMES[faction]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="table-container" aria-busy={loading}>
        <div className={`table-scroll ${loading ? 'opacity-60' : ''}`} style={tableScrollStyle}>
          <table style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Name</th>
                {tab === 'heroes' ? (
                  <>
                    <th>Class</th>
                    <th>Faction</th>
                  </>
                ) : null}
                <th>Rarity</th>
                <th>Owned</th>
                <th>
                  {tab === 'heroes' ? 'Awakening' : tab === 'artifacts' ? 'Promotion' : 'Level'}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tab === 'heroes' ? 6 : 4} className="text-muted text-center">
                    Loading…
                  </td>
                </tr>
              ) : tab === 'heroes' ? (
                filteredHeroes.map((hero) => (
                  <WorRow
                    key={hero.id}
                    tab="heroes"
                    name={hero.name}
                    owned={hero.owned}
                    gaugeLevel={hero.gauge_level}
                    gaugeMax={HERO_AWAKENING_MAX}
                    starRating={hero.star_rating}
                    extraCells={
                      <>
                        <td>{CLASS_DISPLAY_NAMES[hero.class as HeroClassKey] ?? hero.class}</td>
                        <td>{FACTION_DISPLAY_NAMES[hero.faction as FactionKey] ?? hero.faction}</td>
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
                      void patchGauge('heroes', hero.id, next, 'hero_id').catch(handleActionError);
                    }}
                  />
                ))
              ) : tab === 'artifacts' ? (
                filteredArtifacts.map((artifact) => (
                  <WorRow
                    key={artifact.id}
                    tab="artifacts"
                    name={artifact.name}
                    owned={artifact.owned}
                    gaugeLevel={artifact.gauge_level}
                    gaugeMax={ARTIFACT_PROMOTION_MAX}
                    starRating={artifact.star_rating}
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
                filteredDemons.map((demon) => (
                  <WorRow
                    key={demon.id}
                    tab="demons"
                    name={demon.name}
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
                      const next = demon.gauge_level >= demon.max_level ? 0 : demon.gauge_level + 1;
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

      <Modal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        ariaLabelledBy="wor-account-modal-title"
        className="glass-modal-surface"
      >
        <h2 id="wor-account-modal-title">Add account</h2>
        <div className="form-group mt-4">
          <label htmlFor="wor-account-name">Account name</label>
          <input
            id="wor-account-name"
            className="form-input"
            value={accountNameDraft}
            onChange={(event) => setAccountNameDraft(event.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-cancel"
            onClick={() => setAccountModalOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => void createAccount().catch(handleActionError)}
          >
            Create
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
