import { useState } from 'react';

import { UI_STYLES, UI_STYLE_LABELS, useTheme } from '../../context/ThemeContext';
import { SelectDropdown } from './SelectDropdown';

export function UiStyleSelector() {
  const { uiStyle, setUiStyle } = useTheme();
  const [open, setOpen] = useState(false);

  const options = UI_STYLES.map((style) => ({
    value: style,
    label: UI_STYLE_LABELS[style],
  }));

  return (
    <div
      className="user-menu-appearance"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="user-menu-appearance-label" id="ui-style-select-label">
        UI style
      </span>
      <SelectDropdown
        id="ui-style-select"
        value={uiStyle}
        options={options}
        onChange={(value) => {
          const style = UI_STYLES.find((candidate) => candidate === value);
          if (style) setUiStyle(style);
        }}
        open={open}
        onOpenChange={setOpen}
        buttonAriaLabel="UI style"
      />
    </div>
  );
}
