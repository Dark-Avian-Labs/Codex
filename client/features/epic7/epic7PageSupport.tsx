import {
  ARTIFACT_CLASSES,
  ARTIFACT_GAUGE_EMPTY as GAUGE_EMPTY,
  ARTIFACT_GAUGE_FILLED as GAUGE_FILLED,
  ARTIFACT_GAUGE_MAX as GAUGE_MAX,
  CLASS_DISPLAY_NAMES as CLASS_NAMES,
  ELEMENT_DISPLAY_NAMES as ELEMENT_NAMES,
  ELEMENTS,
  GAUGE_COLORS,
  HERO_CLASSES,
  RATING_COLORS,
} from '@codex/game-epic7/constants';
import type { ClassKey, ElementKey } from '@codex/game-epic7/constants';
import { memo, useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { useAutoDismissMessage } from '../../hooks/useAutoDismissMessage';
import { apiFetch } from '../../utils/api';

export type Epic7Hero = {
  id: number;
  name: string;
  class?: string;
  element?: string;
  star_rating?: number;
  rating: '-' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
};
export type Epic7Artifact = {
  id: number;
  name: string;
  class?: string;
  star_rating?: number;
  gauge_level: number;
};
export function isHero(item: Epic7Hero | Epic7Artifact): item is Epic7Hero {
  return 'rating' in item;
}
export type Epic7Account = {
  id: number;
  account_name: string;
  is_active?: number;
  created_at?: string;
};
export type DeletingItem = { id: number; type: 'hero' | 'artifact'; name: string };
export type DeletingAccount = { id: number; account_name: string };
export type Epic7ModalDraft = {
  name: string;
  class: string;
  element: string;
  stars: number;
};
export type Epic7ModalState = {
  isAccountModalOpen: boolean;
  accountNameDraft: string;
  accountEditId: number | null;
  accountEditDraft: string;
  isItemModalOpen: boolean;
  modalItemType: 'heroes' | 'artifacts';
  draft: Epic7ModalDraft;
  editingId: number | null;
  isDeleteModalOpen: boolean;
  deletingItem: DeletingItem | null;
  isAccountDeleteModalOpen: boolean;
  deletingAccount: DeletingAccount | null;
};
export type Epic7ModalAction =
  | { type: 'OPEN_ACCOUNT_MODAL' }
  | { type: 'CLOSE_ACCOUNT_MODAL' }
  | { type: 'SET_ACCOUNT_NAME'; payload: string }
  | { type: 'START_ACCOUNT_EDIT'; payload: { id: number; name: string } }
  | { type: 'SET_ACCOUNT_EDIT_NAME'; payload: string }
  | { type: 'CANCEL_ACCOUNT_EDIT' }
  | { type: 'OPEN_ITEM_MODAL'; payload: { itemType: 'heroes' | 'artifacts' } }
  | { type: 'CLOSE_ITEM_MODAL' }
  | {
      type: 'SET_DRAFT_FIELD';
      payload: { field: keyof Epic7ModalDraft; value: string | number };
    }
  | {
      type: 'START_EDIT';
      payload: {
        itemType: 'heroes' | 'artifacts';
        id: number;
        draft: Epic7ModalDraft;
      };
    }
  | { type: 'START_DELETE'; payload: DeletingItem }
  | { type: 'CANCEL_DELETE' }
  | { type: 'CONFIRM_DELETE' }
  | { type: 'START_ACCOUNT_DELETE'; payload: DeletingAccount }
  | { type: 'CANCEL_ACCOUNT_DELETE' }
  | { type: 'CONFIRM_ACCOUNT_DELETE' };

export type ActiveFilters = { class: ClassKey | null; element: ElementKey | null };

const ICON_MODULES = import.meta.glob('../../../packages/games/epic7/assets/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const ICONS: Record<string, string> = {};
for (const [path, src] of Object.entries(ICON_MODULES)) {
  const file = path.split('/').pop();
  if (!file) continue;
  ICONS[file.replace('.png', '')] = src;
}

export const initialModalState: Epic7ModalState = {
  isAccountModalOpen: false,
  accountNameDraft: '',
  accountEditId: null,
  accountEditDraft: '',
  isItemModalOpen: false,
  modalItemType: 'heroes',
  draft: {
    name: '',
    class: HERO_CLASSES[0],
    element: ELEMENTS[0],
    stars: 5,
  },
  editingId: null,
  isDeleteModalOpen: false,
  deletingItem: null,
  isAccountDeleteModalOpen: false,
  deletingAccount: null,
};

export function epic7ModalReducer(
  state: Epic7ModalState,
  action: Epic7ModalAction,
): Epic7ModalState {
  switch (action.type) {
    case 'OPEN_ACCOUNT_MODAL':
      return { ...state, isAccountModalOpen: true };
    case 'CLOSE_ACCOUNT_MODAL':
      return {
        ...state,
        isAccountModalOpen: false,
        accountNameDraft: '',
        accountEditId: null,
        accountEditDraft: '',
      };
    case 'SET_ACCOUNT_NAME':
      return { ...state, accountNameDraft: action.payload };
    case 'START_ACCOUNT_EDIT':
      return {
        ...state,
        accountEditId: action.payload.id,
        accountEditDraft: action.payload.name,
      };
    case 'SET_ACCOUNT_EDIT_NAME':
      return { ...state, accountEditDraft: action.payload };
    case 'CANCEL_ACCOUNT_EDIT':
      return { ...state, accountEditId: null, accountEditDraft: '' };
    case 'OPEN_ITEM_MODAL':
      return {
        ...state,
        isItemModalOpen: true,
        modalItemType: action.payload.itemType,
        editingId: null,
        draft: {
          name: '',
          class: action.payload.itemType === 'heroes' ? HERO_CLASSES[0] : ARTIFACT_CLASSES[0],
          element: ELEMENTS[0],
          stars: 5,
        },
      };
    case 'CLOSE_ITEM_MODAL':
      return { ...state, isItemModalOpen: false };
    case 'SET_DRAFT_FIELD':
      return {
        ...state,
        draft: {
          ...state.draft,
          [action.payload.field]: action.payload.value,
        },
      };
    case 'START_EDIT':
      return {
        ...state,
        isItemModalOpen: true,
        modalItemType: action.payload.itemType,
        editingId: action.payload.id,
        draft: action.payload.draft,
      };
    case 'START_DELETE':
      return {
        ...state,
        isDeleteModalOpen: true,
        deletingItem: action.payload,
      };
    case 'CANCEL_DELETE':
    case 'CONFIRM_DELETE':
      return {
        ...state,
        isDeleteModalOpen: false,
        deletingItem: null,
      };
    case 'START_ACCOUNT_DELETE':
      return {
        ...state,
        isAccountDeleteModalOpen: true,
        deletingAccount: action.payload,
      };
    case 'CANCEL_ACCOUNT_DELETE':
    case 'CONFIRM_ACCOUNT_DELETE':
      return {
        ...state,
        isAccountDeleteModalOpen: false,
        deletingAccount: null,
      };
    default:
      return state;
  }
}

export function renderStars(count: number | undefined) {
  if (!count || count <= 0) return '-';
  const iconSrc = ICONS[`star${count}`];
  if (!iconSrc) return '★'.repeat(count);
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

export function renderGauge(level: number): string {
  return `${GAUGE_FILLED.repeat(level)}${GAUGE_EMPTY.repeat(Math.max(0, GAUGE_MAX - level))}`;
}

export interface Epic7TableRowProps {
  row: Epic7Hero | Epic7Artifact;
  editMode: boolean;
  onCycleHero: (hero: Epic7Hero) => void | Promise<void>;
  onCycleArtifact: (artifact: Epic7Artifact) => void | Promise<void>;
  onEditItem: (item: Epic7Hero | Epic7Artifact) => void;
  onDeleteItem: (item: Epic7Hero | Epic7Artifact) => void;
}

export const Epic7TableRow = memo(function Epic7TableRow({
  row,
  editMode,
  onCycleHero,
  onCycleArtifact,
  onEditItem,
  onDeleteItem,
}: Epic7TableRowProps) {
  return (
    <tr>
      <td className="item-name">{row.name}</td>
      <td className="icon-cell">
        {row.class && ICONS[row.class] ? (
          <img
            className="invert-on-light"
            src={ICONS[row.class]}
            alt={row.class ? (CLASS_NAMES[row.class as ClassKey] ?? row.class) : '-'}
            title={row.class ? (CLASS_NAMES[row.class as ClassKey] ?? row.class) : '-'}
          />
        ) : (
          row.class || '-'
        )}
      </td>
      {isHero(row) ? (
        <td className="icon-cell">
          {row.element && ICONS[row.element] ? (
            <img
              src={ICONS[row.element]}
              alt={row.element ? (ELEMENT_NAMES[row.element as ElementKey] ?? row.element) : '-'}
              title={row.element ? (ELEMENT_NAMES[row.element as ElementKey] ?? row.element) : '-'}
            />
          ) : (
            row.element || '-'
          )}
        </td>
      ) : null}
      <td className="stars-cell">{renderStars(row.star_rating)}</td>
      <td className={isHero(row) ? 'rating-cell' : 'level-cell'}>
        {isHero(row) ? (
          <button
            type="button"
            className="rating-btn"
            style={{
              color: RATING_COLORS[row.rating] ?? '#6b7280',
              borderColor: `${RATING_COLORS[row.rating] ?? '#6b7280'}50`,
              background: `${RATING_COLORS[row.rating] ?? '#6b7280'}20`,
            }}
            onClick={() => {
              void onCycleHero(row);
            }}
            aria-label={`Cycle imprint for ${row.name}`}
          >
            {row.rating}
          </button>
        ) : (
          <button
            type="button"
            className="gauge-btn"
            style={{
              color: GAUGE_COLORS[row.gauge_level] ?? GAUGE_COLORS[0],
            }}
            onClick={() => {
              void onCycleArtifact(row);
            }}
            aria-label={`Cycle limit break for ${row.name}`}
          >
            {renderGauge(row.gauge_level)}
          </button>
        )}
      </td>
      {editMode ? (
        <td className="row-actions">
          <button
            type="button"
            className="btn-icon btn-edit"
            onClick={() => onEditItem(row)}
            aria-label={`Edit ${row.name}`}
          >
            <MaterialSymbol name="edit" />
          </button>
          <button
            type="button"
            className="btn-icon btn-delete"
            onClick={() => onDeleteItem(row)}
            aria-label={`Delete ${row.name}`}
          >
            <MaterialSymbol name="delete" />
          </button>
        </td>
      ) : null}
    </tr>
  );
});

export function useEpic7Modal() {
  return useReducer(epic7ModalReducer, initialModalState);
}

export function useEpic7Filters() {
  const [tab, setTab] = useState<'heroes' | 'artifacts'>('heroes');
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    class: null,
    element: null,
  });
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setActiveFilters({ class: null, element: null });
  }, [tab]);

  return {
    tab,
    setTab,
    search,
    setSearch,
    activeFilters,
    setActiveFilters,
    editMode,
    setEditMode,
  };
}

export function useEpic7Data() {
  const [accounts, setAccounts] = useState<Epic7Account[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<number | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [heroes, setHeroes] = useState<Epic7Hero[]>([]);
  const [artifacts, setArtifacts] = useState<Epic7Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const clearOperationError = useCallback(() => {
    setOperationError(null);
  }, []);
  useAutoDismissMessage(operationError, clearOperationError);

  const beginUserActionRequest = useCallback((): AbortSignal => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return controller.signal;
  }, []);

  const loadAccountsAndData = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      const accountsRes = await apiFetch('/api/epic7/accounts', { signal });
      if (!accountsRes.ok) {
        throw new Error('Failed to load accounts');
      }
      const accountsBody = (await accountsRes.json()) as {
        accounts?: Epic7Account[];
        current_account_id?: number | null;
      };
      const nextAccounts = Array.isArray(accountsBody.accounts) ? accountsBody.accounts : [];
      const nextAccountId =
        typeof accountsBody.current_account_id === 'number'
          ? accountsBody.current_account_id
          : null;
      if (signal?.aborted) return;
      setAccounts(nextAccounts);
      setCurrentAccountId(nextAccountId);
      if (nextAccountId === null) {
        setHeroes([]);
        setArtifacts([]);
        setLoading(false);
        return;
      }

      const [heroesRes, artifactsRes] = await Promise.all([
        apiFetch('/api/epic7/heroes', { signal }),
        apiFetch('/api/epic7/artifacts', { signal }),
      ]);
      if (!heroesRes.ok || !artifactsRes.ok) {
        throw new Error('Failed to load Epic7 data');
      }
      const heroesBody = (await heroesRes.json()) as { heroes?: Epic7Hero[] };
      const artifactsBody = (await artifactsRes.json()) as {
        artifacts?: Epic7Artifact[];
      };
      if (signal?.aborted) return;
      setHeroes(Array.isArray(heroesBody.heroes) ? heroesBody.heroes : []);
      setArtifacts(Array.isArray(artifactsBody.artifacts) ? artifactsBody.artifacts : []);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setLoadError('Could not load Epic Seven data.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const reloadItems = useCallback(
    async (itemType: 'heroes' | 'artifacts', signal?: AbortSignal): Promise<void> => {
      try {
        const response = await apiFetch(`/api/epic7/${itemType}`, { signal });
        if (!response.ok) {
          throw new Error('Failed to reload Epic7 items');
        }
        const body = (await response.json()) as {
          heroes?: Epic7Hero[];
          artifacts?: Epic7Artifact[];
        };
        if (signal?.aborted) return;
        if (itemType === 'heroes') {
          setHeroes(Array.isArray(body.heroes) ? body.heroes : []);
        } else {
          setArtifacts(Array.isArray(body.artifacts) ? body.artifacts : []);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setOperationError('Could not refresh Epic Seven items.');
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadAccountsAndData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadAccountsAndData]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    accounts,
    setAccounts,
    currentAccountId,
    setCurrentAccountId,
    isAccountMenuOpen,
    setIsAccountMenuOpen,
    heroes,
    setHeroes,
    artifacts,
    setArtifacts,
    loading,
    loadError,
    operationError,
    setOperationError,
    abortControllerRef,
    beginUserActionRequest,
    loadAccountsAndData,
    reloadItems,
  };
}
