import type { Ref } from 'react';

import type { UiStyle } from '../../context/ThemeContext';

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
  return (
    <>
      <div
        className="text-muted border-glass-border mt-1 border-t px-3 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase"
        role="presentation"
      >
        Theme
      </div>
      <button
        ref={prismButtonRef}
        type="button"
        className="user-menu-item text-left"
        role="menuitemradio"
        aria-checked={uiStyle === 'prism'}
        tabIndex={menuItemTabIndex}
        onClick={() => setUiStyle('prism')}
      >
        Prism
      </button>
      <button
        ref={shadowButtonRef}
        type="button"
        className="user-menu-item text-left"
        role="menuitemradio"
        aria-checked={uiStyle === 'shadow'}
        tabIndex={menuItemTabIndex}
        onClick={() => setUiStyle('shadow')}
      >
        Shadow
      </button>
    </>
  );
}
