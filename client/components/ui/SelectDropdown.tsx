import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { MaterialSymbol } from './MaterialSymbol';

export interface SelectDropdownOption {
  value: string;
  label: string;
}

interface MenuRect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

interface SelectDropdownProps {
  value: string;
  options: SelectDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  buttonAriaLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}

const MENU_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;
const MENU_MAX_HEIGHT_PX = 224;

export function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  id,
  buttonAriaLabel,
  open,
  onOpenChange,
  disabled,
}: SelectDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);

  const updateMenuPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - MENU_GAP_PX - VIEWPORT_MARGIN_PX;
    const minHeight = Math.max(60, window.innerHeight * 0.2);
    const maxHeight = Math.min(MENU_MAX_HEIGHT_PX, Math.max(minHeight, spaceBelow));
    setMenuRect({
      top: r.bottom + MENU_GAP_PX,
      left: r.left,
      width: r.width,
      maxHeight,
    });
  }, []);
  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setFocusedIndex(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const el = optionRefs.current[focusedIndex];
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, focusedIndex]);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  const listboxId = id ? `${id}-listbox` : undefined;
  const buttonId = id ? `${id}-button` : undefined;

  const handleListboxKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (options.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = options[focusedIndex];
      if (opt) {
        onChange(opt.value);
        onOpenChange(false);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(false);
    }
  };

  const menuNode =
    open &&
    menuRect &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuRef}
        id={listboxId}
        role="listbox"
        onKeyDown={handleListboxKeyDown}
        style={{
          position: 'fixed',
          top: menuRect.top,
          left: menuRect.left,
          right: 'auto',
          width: menuRect.width,
          minWidth: '12rem',
          zIndex: 10000,
        }}
        className="select-dropdown-menu"
      >
        <div
          className="custom-scroll overflow-x-hidden overflow-y-auto rounded-[10px]"
          style={{ maxHeight: menuRect.maxHeight }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isFocused = focusedIndex === i;
            return (
              <button
                key={opt.value !== '' ? opt.value : `__empty_${i}`}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="option"
                tabIndex={isFocused ? 0 : -1}
                aria-selected={isSelected}
                className={`select-dropdown-item text-xs outline-none ${
                  isSelected ? 'is-selected' : ''
                }`}
                onFocus={() => setFocusedIndex(i)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                  }
                }}
                onClick={() => {
                  onChange(opt.value);
                  onOpenChange(false);
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    );
  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        id={buttonId}
        className="user-menu-select-trigger flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={buttonAriaLabel ?? placeholder}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onOpenChange(!open);
        }}
        onKeyDown={(e) => {
          if (open && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onOpenChange(false);
          }
        }}
      >
        <span className="min-w-0 flex-1 truncate" title={label}>
          <span className={value ? 'text-foreground' : 'text-muted'}>{label}</span>
        </span>
        <span aria-hidden className="text-muted inline-flex shrink-0 items-center justify-center">
          {open ? (
            <MaterialSymbol name="expand_less" style={{ fontSize: 16 }} />
          ) : (
            <MaterialSymbol name="expand_more" style={{ fontSize: 16 }} />
          )}
        </span>
      </button>
      {menuNode}
    </div>
  );
}
