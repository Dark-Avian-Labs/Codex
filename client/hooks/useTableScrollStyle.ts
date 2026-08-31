import { useLayoutEffect, useState, type CSSProperties, type RefCallback } from 'react';

export function useTableScrollStyle(
  fallbackPx: number,
  layoutKey?: string | number,
): {
  tableScrollRef: RefCallback<HTMLDivElement>;
  tableScrollStyle: CSSProperties;
} {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(fallbackPx);

  useLayoutEffect(() => {
    if (!el) return undefined;

    const update = () => {
      setOffset(Math.max(0, Math.round(el.getBoundingClientRect().top)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [el, layoutKey]);

  return {
    tableScrollRef: setEl,
    tableScrollStyle: { '--header-offset': `${offset}px` } as CSSProperties,
  };
}
