import { useEffect, useRef, useState } from 'react';

import { appIdsMatch, loadDalAppNav, type DalAppNavEntry } from '../../lib/dalAppNav';
import { MaterialSymbol } from '../ui/MaterialSymbol';
import { DalAppNavRail } from './DalAppNavRail';

const COLLAPSE_DELAY_MS = 300;

function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onChange = () => setHoverCapable(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return hoverCapable;
}

export function DalAppNav({ currentAppId }: { currentAppId: string }) {
  const [apps, setApps] = useState<DalAppNavEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const hoverCapable = useHoverCapable();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDalAppNav().then((document) => {
      if (cancelled) return;
      if (!document || document.apps.length === 0) {
        setApps(null);
        return;
      }
      setApps(document.apps);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open || hoverCapable) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, hoverCapable]);

  if (!apps) return null;

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  };

  const scheduleCollapse = () => {
    clearCollapseTimer();
    collapseTimerRef.current = setTimeout(() => {
      setOpen(false);
      collapseTimerRef.current = null;
    }, COLLAPSE_DELAY_MS);
  };

  const onRegionEnter = () => {
    if (!hoverCapable) return;
    clearCollapseTimer();
    setOpen(true);
  };

  const onRegionLeave = () => {
    if (!hoverCapable) return;
    scheduleCollapse();
  };

  const onHandleClick = () => {
    if (hoverCapable) return;
    setOpen((prev) => !prev);
  };

  return (
    <div
      ref={rootRef}
      className={`dal-app-nav${open ? ' dal-app-nav--open' : ''}`}
      onMouseEnter={onRegionEnter}
      onMouseLeave={onRegionLeave}
    >
      <button
        type="button"
        className="dal-app-nav__handle"
        aria-expanded={open}
        aria-controls="dal-app-nav-panel"
        aria-label={open ? 'Close Dark Avian Labs apps' : 'Open Dark Avian Labs apps'}
        onClick={onHandleClick}
      >
        <DalAppNavRail />
      </button>

      <nav
        id="dal-app-nav-panel"
        className="dal-app-nav__panel"
        aria-label="Dark Avian Labs apps"
        hidden={!open}
      >
        <ul className="dal-app-nav__list">
          {apps.map((app) => {
            const isCurrent = appIdsMatch(app.id, currentAppId);
            return (
              <li key={app.id}>
                <a
                  href={app.href}
                  className={`dal-app-nav__link header-link${isCurrent ? ' active' : ''}`}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  <MaterialSymbol name={app.icon} />
                  <span>{app.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
