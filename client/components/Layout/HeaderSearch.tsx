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
  // Last value we pushed to the parent. Used so a lagging parent `value` cannot
  // overwrite newer keystrokes / backspaces while debounce is in flight.
  const lastEmittedRef = useRef(value);
  onChangeRef.current = onChange;

  const clearDebounceTimer = (): void => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  useEffect(() => {
    // Only mirror external resets (clear from outside, route remount, etc.).
    // Ignore echoes of our own debounced onChange — those can be stale vs local text.
    if (value === lastEmittedRef.current) {
      return;
    }
    lastEmittedRef.current = value;
    clearDebounceTimer();
    setText(value);
  }, [value]);

  useEffect(() => clearDebounceTimer, []);

  const emitChange = (next: string): void => {
    lastEmittedRef.current = next;
    onChangeRef.current(next);
  };

  const handleTextChange = (next: string): void => {
    setText(next);
    clearDebounceTimer();
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      emitChange(next);
    }, debounceMs);
  };

  const handleClear = (): void => {
    clearDebounceTimer();
    setText('');
    emitChange('');
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
