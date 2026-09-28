import { useEffect, useRef, type KeyboardEvent } from 'react';

function enabledMenuItems(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter((item) => {
    if (item.hasAttribute('disabled')) return false;
    return item.getAttribute('aria-disabled') !== 'true';
  });
}

export function useRovingMenu(open: boolean, setOpen: (open: boolean) => void) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const prevOpenRef = useRef(open);

  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.select-dropdown-menu')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      enabledMenuItems(menuRef.current)[0]?.focus();
    } else if (prevOpenRef.current) {
      triggerRef.current?.focus();
    }
    prevOpenRef.current = open;
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    if (
      key !== 'ArrowDown' &&
      key !== 'ArrowUp' &&
      key !== 'Home' &&
      key !== 'End' &&
      key !== 'Escape'
    ) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest('.select-dropdown-menu, .user-menu-select-trigger')
    ) {
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      if (document.querySelector('.select-dropdown-menu')) return;
      setOpen(false);
      return;
    }

    const items = enabledMenuItems(menuRef.current);
    if (items.length === 0) return;
    event.preventDefault();
    if (key === 'Home') {
      items[0]?.focus();
      return;
    }
    if (key === 'End') {
      items[items.length - 1]?.focus();
      return;
    }

    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const currentIndex = active ? items.indexOf(active) : -1;
    const direction = key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? key === 'ArrowDown'
          ? 0
          : items.length - 1
        : (currentIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return { menuRef, triggerRef, onMenuKeyDown };
}
