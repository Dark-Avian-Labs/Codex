import { type RefObject, useEffect } from 'react';

import { canvasDpiScale, snapAsciiCellWidth } from './canvasDpiScale';
import {
  applyCascadiaTypographyToContext,
  DEFAULT_CASCADIA_TYPOGRAPHY,
} from './cascadiaCanvasTypography';
import { drawAsciiOverlayFrame, phaseFromClock } from './drawAsciiOverlayFrame';

const PERIOD_SEC = 22;
const ANGLE_DEG = 135;
const PANEL_SELECTOR = [
  '.glass-shell',
  '.glass-surface',
  '.glass-tooltip-surface',
  '.glass-panel',
  '.glass-light',
  '.table-container',
].join(',');
const HYBRID_CLASS = 'bg-hybrid-active';
const DEFAULT_BG_BLUR_PX = 12;

type Slice = {
  panel: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  wrapper: HTMLDivElement;
};

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
    const root = document.documentElement;
    const body = document.body;

    const compositeCanvas = document.createElement('canvas');
    const compositeCtx = compositeCanvas.getContext('2d');
    const blurredCanvas = document.createElement('canvas');
    const blurredCtx = blurredCanvas.getContext('2d');
    const gradientCanvas = document.createElement('canvas');
    const gradientCtx = gradientCanvas.getContext('2d');
    const overlayLayer = document.createElement('div');
    overlayLayer.className = 'bg-blur-slice-layer';
    body.appendChild(overlayLayer);

    if (!compositeCtx || !blurredCtx || !gradientCtx) {
      overlayLayer.remove();
      return undefined;
    }

    const slices = new Map<HTMLElement, Slice>();
    let viewportW = window.innerWidth;
    let viewportH = window.innerHeight;

    const readBgBlurPx = (): number => {
      const raw = getComputedStyle(root).getPropertyValue('--bg-blur-radius').trim();
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : DEFAULT_BG_BLUR_PX;
    };

    const hybridEnabled = (): boolean => !root.classList.contains('ui-clear');

    const updateHybridClass = (): void => {
      root.classList.toggle(HYBRID_CLASS, hybridEnabled());
    };

    const drawGradient = () => {
      viewportW = window.innerWidth;
      viewportH = window.innerHeight;
      gradientCanvas.width = Math.floor(viewportW * dpiScale);
      gradientCanvas.height = Math.floor(viewportH * dpiScale);
      gradientCtx.setTransform(dpiScale, 0, 0, dpiScale, 0, 0);
      const start = getComputedStyle(root).getPropertyValue('--color-bg-start').trim() || '#05060d';
      const end = getComputedStyle(root).getPropertyValue('--color-bg-end').trim() || '#11131d';
      const glow =
        getComputedStyle(root).getPropertyValue('--color-bg-glow').trim() || 'rgba(80,90,120,0.14)';
      const ramp = gradientCtx.createLinearGradient(0, 0, 0, viewportH);
      ramp.addColorStop(0, start);
      ramp.addColorStop(0.35, start);
      ramp.addColorStop(0.72, end);
      ramp.addColorStop(1, end);
      gradientCtx.fillStyle = ramp;
      gradientCtx.fillRect(0, 0, viewportW, viewportH);

      const g1 = gradientCtx.createRadialGradient(
        viewportW * 0.1,
        viewportH * 0.1,
        0,
        viewportW * 0.1,
        viewportH * 0.1,
        viewportW * 0.4,
      );
      g1.addColorStop(0, glow);
      g1.addColorStop(1, 'transparent');
      gradientCtx.fillStyle = g1;
      gradientCtx.fillRect(0, 0, viewportW, viewportH);

      const g2 = gradientCtx.createRadialGradient(
        viewportW * 0.85,
        viewportH * 0.15,
        0,
        viewportW * 0.85,
        viewportH * 0.15,
        viewportW * 0.45,
      );
      g2.addColorStop(0, glow);
      g2.addColorStop(1, 'transparent');
      gradientCtx.fillStyle = g2;
      gradientCtx.fillRect(0, 0, viewportW, viewportH);

      const image = gradientCtx.getImageData(0, 0, gradientCanvas.width, gradientCanvas.height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() - 0.5) * 3;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
      }
      gradientCtx.putImageData(image, 0, 0);
    };

    const ensureSlice = (panel: HTMLElement): Slice | null => {
      const existing = slices.get(panel);
      if (existing) return existing;
      const wrapper = document.createElement('div');
      wrapper.className = 'bg-blur-slice';
      const sliceCanvas = document.createElement('canvas');
      const sliceCtx = sliceCanvas.getContext('2d');
      if (!sliceCtx) return null;
      wrapper.appendChild(sliceCanvas);
      overlayLayer.appendChild(wrapper);
      const next = { panel, canvas: sliceCanvas, ctx: sliceCtx, wrapper };
      slices.set(panel, next);
      return next;
    };

    const syncSlices = () => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>(PANEL_SELECTOR)).filter(
        (panel) =>
          !panel.classList.contains('glass-modal-surface') &&
          !panel.classList.contains('user-menu') &&
          !panel.classList.contains('select-dropdown-menu') &&
          !panel.classList.contains('account-dropdown'),
      );
      const nextSet = new Set(panels);
      for (const [panel, slice] of slices) {
        if (!nextSet.has(panel)) {
          slice.wrapper.remove();
          slices.delete(panel);
        }
      }
      for (const panel of panels) {
        const slice = ensureSlice(panel);
        if (!slice) continue;
        const rect = panel.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          slice.wrapper.style.display = 'none';
          continue;
        }
        slice.wrapper.style.display = 'block';
        slice.wrapper.style.left = `${rect.left}px`;
        slice.wrapper.style.top = `${rect.top}px`;
        slice.wrapper.style.width = `${rect.width}px`;
        slice.wrapper.style.height = `${rect.height}px`;
        slice.wrapper.style.borderRadius = getComputedStyle(panel).borderRadius;
        slice.wrapper.classList.toggle(
          'bg-blur-slice--liquid',
          root.classList.contains('ui-liquid'),
        );

        const sw = Math.floor(viewportW * dpiScale);
        const sh = Math.floor(viewportH * dpiScale);
        if (slice.canvas.width !== sw || slice.canvas.height !== sh) {
          slice.canvas.width = sw;
          slice.canvas.height = sh;
          slice.canvas.style.width = `${viewportW}px`;
          slice.canvas.style.height = `${viewportH}px`;
        }
        slice.canvas.style.left = `${-rect.left}px`;
        slice.canvas.style.top = `${-rect.top}px`;
      }
    };

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

      updateHybridClass();
      if (!hybridEnabled()) {
        overlayLayer.style.display = 'none';
        return;
      }
      overlayLayer.style.display = 'block';
      viewportW = window.innerWidth;
      viewportH = window.innerHeight;

      compositeCanvas.width = Math.floor(viewportW * dpiScale);
      compositeCanvas.height = Math.floor(viewportH * dpiScale);
      blurredCanvas.width = compositeCanvas.width;
      blurredCanvas.height = compositeCanvas.height;
      compositeCtx.setTransform(dpiScale, 0, 0, dpiScale, 0, 0);
      blurredCtx.setTransform(dpiScale, 0, 0, dpiScale, 0, 0);
      compositeCtx.clearRect(0, 0, viewportW, viewportH);
      compositeCtx.drawImage(gradientCanvas, 0, 0, viewportW, viewportH);
      const ox = (viewportW - w) / 2;
      const oy = (viewportH - h) / 2;
      compositeCtx.drawImage(canvas, ox, oy, w, h);

      const blurPx = readBgBlurPx();
      blurredCtx.clearRect(0, 0, viewportW, viewportH);
      blurredCtx.filter = `blur(${blurPx}px) saturate(1.2)`;
      blurredCtx.drawImage(compositeCanvas, 0, 0, viewportW, viewportH);
      blurredCtx.filter = 'none';

      syncSlices();
      for (const slice of slices.values()) {
        slice.ctx.setTransform(dpiScale, 0, 0, dpiScale, 0, 0);
        slice.ctx.clearRect(0, 0, viewportW, viewportH);
        slice.ctx.drawImage(blurredCanvas, 0, 0, viewportW, viewportH);
      }
    };

    const themeObserver = new MutationObserver(() => {
      colors = readAsciiCanvasColors();
      drawGradient();
      if (prefersReduce) {
        paint(performance.now());
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    const panelObserver = new MutationObserver(() => {
      if (prefersReduce) {
        paint(performance.now());
      }
    });
    panelObserver.observe(document.body, { childList: true, subtree: true });
    const onResize = () => {
      drawGradient();
      if (prefersReduce) {
        paint(performance.now());
      }
    };
    window.addEventListener('resize', onResize);
    drawGradient();

    if (prefersReduce) {
      paint(performance.now());
      return () => {
        overlayLayer.remove();
        root.classList.remove(HYBRID_CLASS);
        window.removeEventListener('resize', onResize);
        panelObserver.disconnect();
        themeObserver.disconnect();
      };
    }

    let raf = 0;
    const tick = (t: number) => {
      paint(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      overlayLayer.remove();
      root.classList.remove(HYBRID_CLASS);
      window.removeEventListener('resize', onResize);
      panelObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [asciiRows, asciiRowsAlt, asciiMaskRows, direction]);
}
