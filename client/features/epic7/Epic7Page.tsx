import {
  ARTIFACT_CLASSES,
  ARTIFACT_GAUGE_MAX as GAUGE_MAX,
  CLASS_DISPLAY_NAMES as CLASS_NAMES,
  ELEMENT_DISPLAY_NAMES as ELEMENT_NAMES,
  ELEMENTS,
  HERO_CLASSES,
  HERO_RATINGS,
} from '@codex/game-epic7/constants';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { HeaderSearch } from '../../components/Layout/HeaderSearch';
import { useLayoutSlots } from '../../components/Layout/useLayoutSlots';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { LoadErrorBanner } from '../../components/ui/LoadErrorBanner';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import { Modal } from '../../components/ui/Modal';
import { Toast } from '../../components/ui/Toast';
import { useTableScrollStyle } from '../../hooks/useTableScrollStyle';
import { apiFetch } from '../../utils/api';
import {
  Epic7TableRow,
  ICONS,
  isHero,
  useEpic7Data,
  useEpic7Filters,
  useEpic7Modal,
  type Epic7Account,
  type Epic7Artifact,
  type Epic7Hero,
} from './epic7PageSupport';

export function Epic7Page() {
  const { setHeaderCenter, setHeaderActions } = useLayoutSlots();
  const {
    accounts,
    currentAccountId,
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
    beginUserActionRequest,
    loadAccountsAndData,
    reloadItems,
  } = useEpic7Data();
  const { tab, setTab, search, setSearch, activeFilters, setActiveFilters, editMode, setEditMode } =
    useEpic7Filters();
  const [modalState, dispatchModal] = useEpic7Modal();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const { tableScrollRef, tableScrollStyle } = useTableScrollStyle(340, tab);

  const activeRows = useMemo(() => {
    if (tab === 'heroes') {
      return heroes.filter((row) => {
        if (!row.name.toLowerCase().includes(search.trim().toLowerCase())) {
          return false;
        }
        if (activeFilters.class && row.class !== activeFilters.class) {
          return false;
        }
        if (activeFilters.element && row.element !== activeFilters.element) {
          return false;
        }
        return true;
      });
    }
    return artifacts.filter((row) => {
      if (!row.name.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      if (activeFilters.class && row.class !== activeFilters.class) {
        return false;
      }
      return true;
    });
  }, [tab, heroes, artifacts, search, activeFilters]);

  const stats = useMemo(() => {
    const total = activeRows.length;
    if (tab === 'heroes') {
      const heroRows = activeRows as Epic7Hero[];
      const owned = heroRows.filter((hero) => hero.rating !== '-').length;
      const maxed = heroRows.filter((hero) => hero.rating === 'SSS').length;
      return { total, owned, maxed };
    }
    const artifactRows = activeRows as Epic7Artifact[];
    const owned = artifactRows.filter((artifact) => artifact.gauge_level > 0).length;
    const maxed = artifactRows.filter((artifact) => artifact.gauge_level === GAUGE_MAX).length;
    return { total, owned, maxed };
  }, [activeRows, tab]);
  const currentAccount = useMemo(
    () => accounts.find((account) => account.id === currentAccountId) ?? null,
    [accounts, currentAccountId],
  );

  const switchAccount = useCallback(
    async (accountId: number): Promise<void> => {
      if (currentAccountId === accountId) return;
      const signal = beginUserActionRequest();
      try {
        const response = await apiFetch('/api/epic7/accounts/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: accountId }),
          signal,
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Failed to switch account');
        }
        await loadAccountsAndData(signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setOperationError('Failed to switch Epic Seven account.');
      }
    },
    [beginUserActionRequest, currentAccountId, loadAccountsAndData],
  );

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

  const cycleHero = useCallback(
    async (hero: Epic7Hero): Promise<void> => {
      const index = HERO_RATINGS.indexOf(hero.rating);
      const rating = HERO_RATINGS[(index + 1 + HERO_RATINGS.length) % HERO_RATINGS.length];
      setHeroes((previous) =>
        previous.map((candidate) =>
          candidate.id === hero.id ? { ...candidate, rating } : candidate,
        ),
      );
      try {
        const response = await apiFetch(`/api/epic7/heroes/${hero.id}/rating`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Failed to update hero');
        }
      } catch {
        setHeroes((previous) =>
          previous.map((candidate) =>
            candidate.id === hero.id ? { ...candidate, rating: hero.rating } : candidate,
          ),
        );
        setOperationError('Failed to save hero rating.');
      }
    },
    [setHeroes, setOperationError],
  );

  const cycleArtifact = useCallback(
    async (artifact: Epic7Artifact): Promise<void> => {
      const gaugeLevel = (artifact.gauge_level + 1) % (GAUGE_MAX + 1);
      setArtifacts((previous) =>
        previous.map((candidate) =>
          candidate.id === artifact.id ? { ...candidate, gauge_level: gaugeLevel } : candidate,
        ),
      );
      try {
        const response = await apiFetch(`/api/epic7/artifacts/${artifact.id}/gauge`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gauge_level: gaugeLevel }),
        });
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok || body?.error) {
          throw new Error(body?.error || 'Failed to update artifact');
        }
      } catch {
        setArtifacts((previous) =>
          previous.map((candidate) =>
            candidate.id === artifact.id
              ? { ...candidate, gauge_level: artifact.gauge_level }
              : candidate,
          ),
        );
        setOperationError('Failed to save artifact gauge.');
      }
    },
    [setArtifacts, setOperationError],
  );

  async function addAccount(): Promise<void> {
    if (modalState.accountNameDraft.trim().length === 0) {
      setOperationError('Account name is required.');
      return;
    }
    const signal = beginUserActionRequest();
    try {
      const response = await apiFetch('/api/epic7/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: modalState.accountNameDraft.trim(),
        }),
        signal,
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok || body?.error) {
        throw new Error(body?.error || 'Failed to add account');
      }
      dispatchModal({ type: 'CLOSE_ACCOUNT_MODAL' });
      await loadAccountsAndData(signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setOperationError('Failed to create account.');
    }
  }

  async function renameAccount(accountId: number): Promise<void> {
    const nextName = modalState.accountEditDraft.trim();
    if (!nextName) {
      setOperationError('Account name is required.');
      return;
    }
    const signal = beginUserActionRequest();
    try {
      const response = await apiFetch(`/api/epic7/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_name: nextName }),
        signal,
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok || body?.error) {
        throw new Error(body?.error || 'Failed to rename account');
      }
      dispatchModal({ type: 'CANCEL_ACCOUNT_EDIT' });
      await loadAccountsAndData(signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setOperationError('Failed to rename account.');
    }
  }

  async function deleteAccount(): Promise<void> {
    const deletingAccount = modalState.deletingAccount;
    if (!deletingAccount) {
      return;
    }
    const signal = beginUserActionRequest();
    try {
      const response = await apiFetch(`/api/epic7/accounts/${deletingAccount.id}`, {
        method: 'DELETE',
        signal,
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok || body?.error) {
        throw new Error(body?.error || 'Failed to delete account');
      }
      dispatchModal({ type: 'CONFIRM_ACCOUNT_DELETE' });
      if (modalState.accountEditId === deletingAccount.id) {
        dispatchModal({ type: 'CANCEL_ACCOUNT_EDIT' });
      }
      await loadAccountsAndData(signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setOperationError('Failed to delete account.');
    }
  }

  function openDeleteAccountModal(account: Epic7Account): void {
    dispatchModal({
      type: 'START_ACCOUNT_DELETE',
      payload: { id: account.id, account_name: account.account_name },
    });
  }

  async function deleteItem(): Promise<void> {
    if (!modalState.deletingItem) return;
    const path = modalState.deletingItem.type === 'hero' ? 'heroes' : 'artifacts';
    const signal = beginUserActionRequest();
    try {
      const response = await apiFetch(`/api/epic7/${path}/${modalState.deletingItem.id}`, {
        method: 'DELETE',
        signal,
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Failed to delete item');
      }
      dispatchModal({ type: 'CONFIRM_DELETE' });
      await reloadItems(path, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setOperationError('Failed to delete item.');
    }
  }

  const openAddItemModal = useCallback((): void => {
    dispatchModal({
      type: 'OPEN_ITEM_MODAL',
      payload: { itemType: tab },
    });
  }, [tab]);

  const openEditItemModal = useCallback((item: Epic7Hero | Epic7Artifact): void => {
    const itemType = 'rating' in item ? 'heroes' : 'artifacts';
    dispatchModal({
      type: 'START_EDIT',
      payload: {
        itemType,
        id: item.id,
        draft: {
          name: item.name,
          class: item.class || (itemType === 'heroes' ? HERO_CLASSES[0] : ARTIFACT_CLASSES[0]),
          element: 'rating' in item ? item.element || ELEMENTS[0] : ELEMENTS[0],
          stars: item.star_rating || 5,
        },
      },
    });
  }, []);

  const openDeleteItemModal = useCallback((item: Epic7Hero | Epic7Artifact): void => {
    dispatchModal({
      type: 'START_DELETE',
      payload: {
        id: item.id,
        type: isHero(item) ? 'hero' : 'artifact',
        name: item.name,
      },
    });
  }, []);

  async function saveItem(): Promise<void> {
    if (modalState.draft.name.trim().length === 0) {
      setOperationError('Name is required.');
      return;
    }
    const isHeroItem = modalState.modalItemType === 'heroes';
    const isEdit = modalState.editingId !== null;
    const path = isHeroItem ? 'heroes' : 'artifacts';
    const url = isEdit
      ? `/api/epic7/${path}/${modalState.editingId}/details`
      : `/api/epic7/${path}`;
    const method = isEdit ? 'PATCH' : 'POST';
    const body = isHeroItem
      ? {
          name: modalState.draft.name.trim(),
          class: modalState.draft.class,
          element: modalState.draft.element,
          star_rating: modalState.draft.stars,
        }
      : {
          name: modalState.draft.name.trim(),
          class: modalState.draft.class,
          star_rating: modalState.draft.stars,
        };
    const signal = beginUserActionRequest();
    try {
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Failed to save item');
      }
      dispatchModal({ type: 'CLOSE_ITEM_MODAL' });
      await reloadItems(path, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setOperationError('Failed to save item.');
    }
  }

  useEffect(() => {
    setHeaderCenter(
      <HeaderSearch
        inputId="codex-epic7-header-search"
        ariaLabel="Search Epic Seven entries"
        value=""
        onChange={setSearch}
      />,
    );
    return () => {
      setHeaderCenter(null);
    };
  }, [setHeaderCenter, setSearch]);

  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <div className="account-selector" ref={accountMenuRef}>
          <button
            id="epic7-account-select"
            type="button"
            className="account-btn"
            aria-label="Select Epic Seven account"
            aria-haspopup="listbox"
            aria-expanded={isAccountMenuOpen}
            aria-controls="epic7-account-listbox"
            onClick={() => setIsAccountMenuOpen((previous) => !previous)}
          >
            {currentAccount?.account_name ?? 'No account'}
          </button>
          <div
            id="epic7-account-listbox"
            className={`account-dropdown ${isAccountMenuOpen ? 'show' : ''}`}
            role="listbox"
            aria-label="Epic Seven accounts"
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
                        void switchAccount(account.id);
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
        <button
          type="button"
          className={`header-link ${editMode ? 'active' : ''}`}
          onClick={() => setEditMode((previous) => !previous)}
        >
          {editMode ? 'Done Editing' : 'Edit Mode'}
        </button>
        {editMode ? (
          <button type="button" className="header-link" onClick={openAddItemModal}>
            Add {tab === 'heroes' ? 'Hero' : 'Artifact'}
          </button>
        ) : null}
        <button
          type="button"
          className="header-link"
          onClick={() => dispatchModal({ type: 'OPEN_ACCOUNT_MODAL' })}
        >
          Game Accounts
        </button>
      </div>,
    );
    return () => {
      setHeaderActions(null);
    };
  }, [
    accounts,
    currentAccountId,
    currentAccount,
    editMode,
    isAccountMenuOpen,
    openAddItemModal,
    setHeaderActions,
    switchAccount,
    tab,
  ]);

  if (loading) {
    return (
      <div className="loading" role="status" aria-live="polite">
        Loading Epic Seven...
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="space-y-3">
        <LoadErrorBanner message={loadError} onRetry={() => void loadAccountsAndData()} />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <Toast message={operationError} tone="error" onDismiss={() => setOperationError(null)} />
      <div className="tabs" role="tablist" aria-label="Epic Seven data tabs">
        <button
          id="epic7-tab-heroes"
          type="button"
          className={`tab ${tab === 'heroes' ? 'active' : ''}`}
          role="tab"
          aria-selected={tab === 'heroes'}
          aria-controls="epic7-panel"
          onClick={() => setTab('heroes')}
        >
          Heroes
        </button>
        <button
          id="epic7-tab-artifacts"
          type="button"
          className={`tab ${tab === 'artifacts' ? 'active' : ''}`}
          role="tab"
          aria-selected={tab === 'artifacts'}
          aria-controls="epic7-panel"
          onClick={() => setTab('artifacts')}
        >
          Artifacts
        </button>
      </div>
      <div
        id="epic7-panel"
        role="tabpanel"
        aria-labelledby={tab === 'heroes' ? 'epic7-tab-heroes' : 'epic7-tab-artifacts'}
      >
        <div className="filter-bar" id="filter-bar">
          {tab === 'heroes' ? (
            <>
              <div className="filter-group">
                <span className="filter-label">Class:</span>
                {HERO_CLASSES.map((classKey) => (
                  <button
                    key={classKey}
                    type="button"
                    className={`filter-icon ${activeFilters.class === classKey ? 'active' : ''}`}
                    title={CLASS_NAMES[classKey]}
                    aria-pressed={activeFilters.class === classKey}
                    aria-label={`Filter by ${CLASS_NAMES[classKey]} class`}
                    onClick={() =>
                      setActiveFilters((previous) => ({
                        ...previous,
                        class: previous.class === classKey ? null : classKey,
                      }))
                    }
                  >
                    <img
                      className="invert-on-light"
                      src={ICONS[classKey]}
                      alt={CLASS_NAMES[classKey]}
                    />
                  </button>
                ))}
              </div>
              <div className="filter-group">
                <span className="filter-label">Element:</span>
                {ELEMENTS.map((elementKey) => (
                  <button
                    key={elementKey}
                    type="button"
                    className={`filter-icon ${activeFilters.element === elementKey ? 'active' : ''}`}
                    title={ELEMENT_NAMES[elementKey]}
                    aria-pressed={activeFilters.element === elementKey}
                    aria-label={`Filter by ${ELEMENT_NAMES[elementKey]} element`}
                    onClick={() =>
                      setActiveFilters((previous) => ({
                        ...previous,
                        element: previous.element === elementKey ? null : elementKey,
                      }))
                    }
                  >
                    <img src={ICONS[elementKey]} alt={ELEMENT_NAMES[elementKey]} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="filter-group">
              <span className="filter-label">Class:</span>
              {ARTIFACT_CLASSES.map((classKey) => (
                <button
                  key={classKey}
                  type="button"
                  className={`filter-icon ${activeFilters.class === classKey ? 'active' : ''}`}
                  title={CLASS_NAMES[classKey]}
                  aria-pressed={activeFilters.class === classKey}
                  aria-label={`Filter by ${CLASS_NAMES[classKey]} class`}
                  onClick={() =>
                    setActiveFilters((previous) => ({
                      ...previous,
                      class: previous.class === classKey ? null : classKey,
                    }))
                  }
                >
                  <img
                    className="invert-on-light"
                    src={ICONS[classKey]}
                    alt={CLASS_NAMES[classKey]}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="stats-bar">
          <div className="stat">
            <span>Total:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat">
            <span>Upgraded:</span>
            <span className="stat-value stat-owned">{stats.owned}</span>
          </div>
          <div className="stat">
            <span>{tab === 'heroes' ? 'SSS:' : 'Max Level:'}</span>
            <span className="stat-value stat-maxed">{stats.maxed}</span>
          </div>
        </div>
        <div className="table-container">
          <div ref={tableScrollRef} className="table-scroll" style={tableScrollStyle}>
            <table className="epic7-table" style={{ tableLayout: 'fixed' }}>
              {tab === 'heroes' ? (
                <colgroup>
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '150px' }} />
                  {editMode ? <col style={{ width: '120px' }} /> : null}
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '150px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '150px' }} />
                  {editMode ? <col style={{ width: '120px' }} /> : null}
                </colgroup>
              )}
              <thead>
                {tab === 'heroes' ? (
                  <tr>
                    <th>Name</th>
                    <th className="icon-cell text-center">Class</th>
                    <th className="icon-cell text-center">Element</th>
                    <th className="text-center">Stars</th>
                    <th className="text-center">Imprint</th>
                    {editMode ? <th className="text-center">Actions</th> : null}
                  </tr>
                ) : (
                  <tr>
                    <th>Name</th>
                    <th className="icon-cell text-center">Class</th>
                    <th className="text-center">Stars</th>
                    <th className="text-center">Limit Break</th>
                    {editMode ? <th className="text-center">Actions</th> : null}
                  </tr>
                )}
              </thead>
              <tbody>
                {activeRows.map((row) => (
                  <Epic7TableRow
                    key={row.id}
                    row={row}
                    editMode={editMode}
                    onCycleHero={cycleHero}
                    onCycleArtifact={cycleArtifact}
                    onEditItem={openEditItemModal}
                    onDeleteItem={openDeleteItemModal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={modalState.isAccountModalOpen}
        onClose={() => dispatchModal({ type: 'CLOSE_ACCOUNT_MODAL' })}
        className="glass-modal-surface max-w-lg p-6"
        ariaLabelledBy="epic7-account-modal-title"
      >
        <h2 id="epic7-account-modal-title" className="mb-4 text-lg font-semibold">
          Game Accounts
        </h2>
        <div className="account-manager-list">
          {accounts.length === 0 ? (
            <p className="text-muted text-sm">No accounts yet.</p>
          ) : (
            accounts.map((account) => {
              const isEditing = modalState.accountEditId === account.id;
              const isActive = currentAccountId === account.id;
              return (
                <div key={account.id} className="account-manager-row">
                  {isEditing ? (
                    <input
                      id={`codex-epic7-account-edit-${account.id}`}
                      value={modalState.accountEditDraft}
                      onChange={(event) =>
                        dispatchModal({
                          type: 'SET_ACCOUNT_EDIT_NAME',
                          payload: event.target.value,
                        })
                      }
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
                        onClick={() => {
                          void switchAccount(account.id);
                        }}
                      >
                        Use
                      </button>
                    ) : null}
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-accent"
                          onClick={() => {
                            void renameAccount(account.id);
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-cancel"
                          onClick={() => dispatchModal({ type: 'CANCEL_ACCOUNT_EDIT' })}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() =>
                            dispatchModal({
                              type: 'START_ACCOUNT_EDIT',
                              payload: {
                                id: account.id,
                                name: account.account_name,
                              },
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            openDeleteAccountModal(account);
                          }}
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
          <label htmlFor="epic7-account-name">Account name</label>
          <input
            id="epic7-account-name"
            value={modalState.accountNameDraft}
            onChange={(event) =>
              dispatchModal({
                type: 'SET_ACCOUNT_NAME',
                payload: event.target.value,
              })
            }
          />
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-cancel"
            onClick={() => dispatchModal({ type: 'CLOSE_ACCOUNT_MODAL' })}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={() => void addAccount()}>
            Add Account
          </button>
        </div>
      </Modal>

      <Modal
        open={modalState.isItemModalOpen}
        onClose={() => dispatchModal({ type: 'CLOSE_ITEM_MODAL' })}
        className="glass-modal-surface max-w-lg p-6"
        ariaLabelledBy="epic7-item-modal-title"
      >
        <h2 id="epic7-item-modal-title" className="mb-4 text-lg font-semibold">
          {modalState.editingId === null
            ? `Add ${modalState.modalItemType === 'heroes' ? 'Hero' : 'Artifact'}`
            : `Edit ${modalState.modalItemType === 'heroes' ? 'Hero' : 'Artifact'}`}
        </h2>
        <div className="form-group">
          <label htmlFor="epic7-item-name">Name</label>
          <input
            id="epic7-item-name"
            value={modalState.draft.name}
            onChange={(event) =>
              dispatchModal({
                type: 'SET_DRAFT_FIELD',
                payload: { field: 'name', value: event.target.value },
              })
            }
          />
        </div>
        <div className="form-group">
          <label htmlFor="epic7-item-class">Class</label>
          <select
            id="epic7-item-class"
            value={modalState.draft.class}
            onChange={(event) =>
              dispatchModal({
                type: 'SET_DRAFT_FIELD',
                payload: { field: 'class', value: event.target.value },
              })
            }
          >
            {(modalState.modalItemType === 'heroes' ? HERO_CLASSES : ARTIFACT_CLASSES).map(
              (value) => (
                <option key={value} value={value}>
                  {CLASS_NAMES[value]}
                </option>
              ),
            )}
          </select>
        </div>
        {modalState.modalItemType === 'heroes' ? (
          <div className="form-group">
            <label htmlFor="epic7-item-element">Element</label>
            <select
              id="epic7-item-element"
              value={modalState.draft.element}
              onChange={(event) =>
                dispatchModal({
                  type: 'SET_DRAFT_FIELD',
                  payload: { field: 'element', value: event.target.value },
                })
              }
            >
              {ELEMENTS.map((value) => (
                <option key={value} value={value}>
                  {ELEMENT_NAMES[value]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="form-group">
          <label htmlFor="epic7-item-stars">Stars</label>
          <select
            id="epic7-item-stars"
            value={modalState.draft.stars}
            onChange={(event) =>
              dispatchModal({
                type: 'SET_DRAFT_FIELD',
                payload: { field: 'stars', value: Number(event.target.value) },
              })
            }
          >
            {[3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-cancel"
            onClick={() => dispatchModal({ type: 'CLOSE_ITEM_MODAL' })}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={() => void saveItem()}>
            Save
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={modalState.isAccountDeleteModalOpen}
        title="Delete Account"
        message={`Delete ${modalState.deletingAccount?.account_name || 'this account'}? This also removes heroes and artifacts in this account.`}
        confirmLabel="Delete"
        onConfirm={() => void deleteAccount()}
        onCancel={() => dispatchModal({ type: 'CANCEL_ACCOUNT_DELETE' })}
      />

      <ConfirmModal
        open={modalState.isDeleteModalOpen}
        title={`Delete ${modalState.deletingItem?.type === 'hero' ? 'Hero' : 'Artifact'}`}
        message={`Delete ${modalState.deletingItem?.name || 'this item'}?`}
        confirmLabel="Delete"
        onConfirm={() => void deleteItem()}
        onCancel={() => dispatchModal({ type: 'CANCEL_DELETE' })}
      />
    </section>
  );
}
