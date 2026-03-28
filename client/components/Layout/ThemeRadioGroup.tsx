import { useId, type Ref } from 'react';

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
    </div>
  );
}
