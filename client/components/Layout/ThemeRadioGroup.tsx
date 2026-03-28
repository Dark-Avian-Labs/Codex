import clsx from 'clsx';
import { useId, type Ref } from 'react';

import type { UiStyle } from '../../context/ThemeContext';

function MenuRadioCheckIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3.5 8.5L6.5 11.5L12.5 5.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ThemeRadioGroupProps = {
  uiStyle: UiStyle;
  setUiStyle: (style: UiStyle) => void;
  prismButtonRef?: Ref<HTMLButtonElement | null>;
  shadowButtonRef?: Ref<HTMLButtonElement | null>;
  /** Roving tabindex for menu keyboard navigation (e.g. -1) */
  menuItemTabIndex?: number;
};

export function ThemeRadioGroup({
  uiStyle,
  setUiStyle,
  prismButtonRef,
  shadowButtonRef,
  menuItemTabIndex,
}: ThemeRadioGroupProps) {
  const themeGroupLabelId = useId();

  return (
    <div role="radiogroup" aria-labelledby={themeGroupLabelId}>
      <div
        id={themeGroupLabelId}
        className="text-muted border-glass-border mt-1 border-t px-3 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase"
      >
        Theme
      </div>
      <button
        ref={prismButtonRef}
        type="button"
        className={clsx(
          'user-menu-item flex w-full items-center justify-between gap-2 text-left',
          uiStyle === 'prism' && 'text-foreground bg-[var(--color-glass-hover)]',
        )}
        role="menuitemradio"
        aria-checked={uiStyle === 'prism'}
        tabIndex={menuItemTabIndex}
        onClick={() => setUiStyle('prism')}
      >
        <span>Prism</span>
        <span
          className="text-foreground inline-flex h-4 w-4 shrink-0 items-center justify-center"
          aria-hidden
        >
          {uiStyle === 'prism' ? <MenuRadioCheckIcon /> : null}
        </span>
      </button>
      <button
        ref={shadowButtonRef}
        type="button"
        className={clsx(
          'user-menu-item flex w-full items-center justify-between gap-2 text-left',
          uiStyle === 'shadow' && 'text-foreground bg-[var(--color-glass-hover)]',
        )}
        role="menuitemradio"
        aria-checked={uiStyle === 'shadow'}
        tabIndex={menuItemTabIndex}
        onClick={() => setUiStyle('shadow')}
      >
        <span>Shadow</span>
        <span
          className="text-foreground inline-flex h-4 w-4 shrink-0 items-center justify-center"
          aria-hidden
        >
          {uiStyle === 'shadow' ? <MenuRadioCheckIcon /> : null}
        </span>
      </button>
    </div>
  );
}
