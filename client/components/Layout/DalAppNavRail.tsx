import { useEffect, useId, useRef, useState } from 'react';

import { buildOutsideInRailTriangles } from './dalAppNavRail';

const SQRT3 = Math.sqrt(3);

export function DalAppNavRail() {
  const rawId = useId().replace(/:/g, '');
  const fillId = `dal-nav-rail-fill-${rawId}`;
  const strokeId = `dal-nav-rail-stroke-${rawId}`;
  const railRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const side = 10;
  const innerWidth = (SQRT3 / 2) * side;
  const step = side + 6;
  const strokeWidth = 1.25;
  const pad = strokeWidth / 2 + 0.35;
  const svgWidth = innerWidth + pad * 2;
  const x0 = pad;
  const x1 = pad + innerWidth;

  useEffect(() => {
    const host = railRef.current;
    if (!host) return;

    const update = () => {
      setHeight(host.getBoundingClientRect().height);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const triangles = height > 0 ? buildOutsideInRailTriangles(height, x0, x1, side, step, 41) : [];

  return (
    <div ref={railRef} className="dal-app-nav__rail" aria-hidden="true">
      {triangles.length > 0 && (
        <svg
          className="dal-app-nav__rail-svg"
          width={svgWidth}
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
        >
          <defs>
            <linearGradient
              id={fillId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={height}
            >
              <stop offset="0%" stopColor="var(--color-accent)" />
              <stop offset="100%" stopColor="var(--color-foreground)" />
            </linearGradient>
            <linearGradient
              id={strokeId}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={height}
            >
              <stop offset="0%" stopColor="var(--color-accent)" />
              <stop offset="100%" stopColor="var(--color-foreground)" />
            </linearGradient>
          </defs>
          {triangles.map((tri, i) => (
            <polygon
              key={i}
              points={tri.points}
              fill={tri.outline ? 'none' : `url(#${fillId})`}
              stroke={tri.outline ? `url(#${strokeId})` : 'none'}
              strokeWidth={tri.outline ? strokeWidth : 0}
              strokeLinejoin="miter"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
