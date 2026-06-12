import { memo, useEffect, useRef, useState } from 'react';

import { MaterialSymbol } from '../ui/MaterialSymbol';

interface HeaderSearchProps {
  inputId: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
}

export const HeaderSearch = memo(function HeaderSearch({
  inputId,
  ariaLabel,
  value,
  onChange,
  debounceMs = 150,
  placeholder = 'Search...',
}: HeaderSearchProps) {
  const [text, setText] = useState(value);
  const debounceTimerRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const clearDebounceTimer = (): void => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  useEffect(() => {
    setText((current) => (current === value ? current : value));
  }, [value]);

  useEffect(() => clearDebounceTimer, []);

  const handleTextChange = (next: string): void => {
    setText(next);
    clearDebounceTimer();
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      onChangeRef.current(next);
    }, debounceMs);
  };

  const handleClear = (): void => {
    clearDebounceTimer();
    setText('');
    onChangeRef.current('');
  };

  return (
    <div className="search-wrapper">
      <input
        id={inputId}
        name="search"
        type="text"
        role="searchbox"
        enterKeyHint="search"
        autoComplete="off"
        className="search-box"
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        aria-label={ariaLabel}
        placeholder={placeholder}
      />
      <button
        type="button"
        className={`search-clear ${text.length > 0 ? 'visible' : ''}`}
        aria-label="Clear search"
        onClick={handleClear}
      >
        <MaterialSymbol name="close" className="leading-none" style={{ fontSize: 18 }} />
      </button>
    </div>
  );
});
