import { type RefObject, useEffect } from 'react';

import { canvasDpiScale, snapAsciiCellWidth } from './canvasDpiScale';
import {
  applyCascadiaTypographyToContext,
  CASCADIA_FONT_STACK,
  DEFAULT_CASCADIA_TYPOGRAPHY,
} from './cascadiaCanvasTypography';
import { drawAsciiOverlayFrame, phaseFromClock } from './drawAsciiOverlayFrame';

const PERIOD_SEC = 22;
const ANGLE_DEG = 135;
const FRAME_INTERVAL_MS = 1000 / 30;

function readAsciiCanvasColors(): { fgA: string; fgB: string; fgMask: string } {
  const root = getComputedStyle(document.documentElement);
  let fgA = root.getPropertyValue('--ascii-canvas-fg').trim();
  let fgB = root.getPropertyValue('--ascii-canvas-fg-bright').trim();
  const fgMask =
    root.getPropertyValue('--ascii-canvas-fg-accent').trim() ||
    'color-mix(in oklab, #ff0000 12%, transparent)';
  if (!fgA) {
    fgA = 'rgba(200,200,200,0.35)';
  }
  if (!fgB) {
    fgB = 'rgba(255,255,255,0.5)';
  }
  return { fgA, fgB, fgMask };
}

async function loadCascadiaMono(): Promise<void> {
  try {
    await import('@fontsource-variable/cascadia-mono');
    await document.fonts.load(`${DEFAULT_CASCADIA_TYPOGRAPHY.fontSizePx}px ${CASCADIA_FONT_STACK}`);
  } catch {
    // ignore
  }
}

export function useAsciiBackgroundCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  asciiRows: string[],
  asciiRowsAlt: string[],
  options?: { direction?: 'down' | 'up'; asciiMaskRows?: string[] },
): void {
  const direction = options?.direction ?? 'down';
  const asciiMaskRows = options?.asciiMaskRows;

  useEffect(() => {
    const rows = asciiRows.length;
    const cols =
      rows === 0
        ? 0
        : Math.max(...asciiRows.map((r) => r.length), ...asciiRowsAlt.map((r) => r.length));
    if (rows === 0 || cols === 0) {
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    let cancelled = false;
    let raf = 0;
    let themeObserver: MutationObserver | null = null;

    void (async () => {
      await loadCascadiaMono();
      if (cancelled) return;

      const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const typography = DEFAULT_CASCADIA_TYPOGRAPHY;
      const dpiScale = canvasDpiScale();

      ctx.imageSmoothingEnabled = false;
      applyCascadiaTypographyToContext(ctx, typography);
      const cellW = snapAsciiCellWidth(ctx, dpiScale);
      const cellH = Math.ceil(typography.lineHeightPx);
      const w = cols * cellW;
      const h = rows * cellH;

      canvas.width = Math.floor(w * dpiScale);
      canvas.height = Math.floor(h * dpiScale);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpiScale, 0, 0, dpiScale, 0, 0);
      applyCascadiaTypographyToContext(ctx, typography);

      const t0 = performance.now();
      let colors = readAsciiCanvasColors();

      const paint = (now: number) => {
        const { fgA, fgB, fgMask } = colors;
        const phase = phaseFromClock(now, t0, PERIOD_SEC, direction);
        drawAsciiOverlayFrame(
          ctx,
          asciiRows,
          asciiRowsAlt,
          cols,
          rows,
          cellW,
          cellH,
          w,
          h,
          phase,
          ANGLE_DEG,
          fgA,
          fgB,
          fgMask,
          asciiMaskRows,
        );
      };

      themeObserver = new MutationObserver(() => {
        colors = readAsciiCanvasColors();
        if (prefersReduce) {
          paint(performance.now());
        }
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });

      if (prefersReduce) {
        paint(performance.now());
        return;
      }

      let lastPaint = 0;
      const tick = (t: number) => {
        raf = requestAnimationFrame(tick);
        if (t - lastPaint < FRAME_INTERVAL_MS) return;
        lastPaint = t;
        paint(t);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      themeObserver?.disconnect();
    };
  }, [asciiRows, asciiRowsAlt, asciiMaskRows, direction]);
}
