import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';

type HexType = 1 | 2 | 3;

type HexSpec = {
  height: number;
  left: number;
  top: number;
  type: HexType;
};

type HexPulse = {
  minOpacity: number;
  maxOpacity: number;
  intervalMinMs: number;
  intervalMaxMs: number;
  initialDelayMs: number;
  startBright: boolean;
};

const PANEL_WIDTH = 335;

const TYPE_BASE_OPACITY: Record<HexType, number> = {
  1: 0.03,
  2: 0.06,
  3: 0.1,
};

const HEX_LAYOUT: HexSpec[] = [
  { height: 154, left: 193, top: 181, type: 1 },
  { height: 154, left: 193, top: 346, type: 2 },
  { height: 154, left: 51, top: 263, type: 3 },
  { height: 154, left: 51, top: 426, type: 1 },
  { height: 74, left: 0, top: 385, type: 2 },
  { height: 74, left: 147, top: 226, type: 2 },
  { height: 28, left: 137, top: 170, type: 1 },
  { height: 140, left: 293, top: 40, type: 2 },
  { height: 64, left: 250, top: 0, type: 3 },
  { height: 273, left: 234, top: 204, type: 3 },
  { height: 220, left: 218, top: 438, type: 1 },
];

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function hexPulse(index: number, side: 'left' | 'right', type: HexType): HexPulse {
  const seed = index * 19 + (side === 'left' ? 0 : 61) + type * 11;
  const minOpacity = TYPE_BASE_OPACITY[type];
  const maxOpacity = Math.min(minOpacity + 0.025 + pseudoRandom(seed) * 0.045, 0.14);

  return {
    minOpacity,
    maxOpacity,
    intervalMinMs: 2500 + pseudoRandom(seed + 1) * 3500,
    intervalMaxMs: 7000 + pseudoRandom(seed + 2) * 9000,
    initialDelayMs: pseudoRandom(seed + 3) * 6000,
    startBright: pseudoRandom(seed + 4) > 0.5,
  };
}

function hexMetrics(height: number) {
  const radius = Math.round(height / Math.sqrt(3));
  const width = radius * 2;
  return { height, width, outerWidth: width };
}

function mirrorLeft(left: number, outerWidth: number) {
  return PANEL_WIDTH - left - outerWidth;
}

function randomInterval(minMs: number, maxMs: number) {
  return minMs + Math.random() * (maxMs - minMs);
}

type HexProps = HexSpec & {
  index: number;
  side: 'left' | 'right';
};

function Hex({ height, left, top, type, index, side }: HexProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pulse = useMemo(() => hexPulse(index, side, type), [index, side, type]);
  const { width, outerWidth } = hexMetrics(height);
  const x = side === 'right' ? left : mirrorLeft(left, outerWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled = false;
    let timeoutId = 0;
    let bright = pulse.startBright;

    const applyOpacity = () => {
      el.style.opacity = String(bright ? pulse.maxOpacity : pulse.minOpacity);
    };

    const scheduleToggle = () => {
      timeoutId = window.setTimeout(
        () => {
          if (cancelled) return;
          bright = !bright;
          applyOpacity();
          scheduleToggle();
        },
        randomInterval(pulse.intervalMinMs, pulse.intervalMaxMs),
      );
    };

    const handleMotionChange = () => {
      window.clearTimeout(timeoutId);
      if (reducedMotion.matches) {
        bright = false;
        applyOpacity();
        return;
      }
      scheduleToggle();
    };

    applyOpacity();

    if (!reducedMotion.matches) {
      timeoutId = window.setTimeout(scheduleToggle, pulse.initialDelayMs);
    }

    reducedMotion.addEventListener('change', handleMotionChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      reducedMotion.removeEventListener('change', handleMotionChange);
    };
  }, [pulse]);

  return (
    <div
      ref={ref}
      className="hex-prism"
      style={
        {
          '--hex-height': `${height}px`,
          '--hex-width': `${width}px`,
          left: `${x}px`,
          top: `${top}px`,
          opacity: pulse.startBright ? pulse.maxOpacity : pulse.minOpacity,
        } as CSSProperties
      }
    />
  );
}

export function HexSideBackground() {
  return (
    <>
      <div className="hex-side-panel hex-side-panel--left" aria-hidden="true">
        <div className="hex-side-cluster-wrap">
          <div className="hex-side-cluster">
            {HEX_LAYOUT.map((hex, index) => (
              <Hex key={`left-${index}`} {...hex} index={index} side="left" />
            ))}
          </div>
        </div>
      </div>
      <div className="hex-side-panel hex-side-panel--right" aria-hidden="true">
        <div className="hex-side-cluster-wrap">
          <div className="hex-side-cluster">
            {HEX_LAYOUT.map((hex, index) => (
              <Hex key={`right-${index}`} {...hex} index={index} side="right" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
