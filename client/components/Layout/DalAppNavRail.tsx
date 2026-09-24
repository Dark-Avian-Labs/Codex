import { useEffect, useRef, useState } from 'react';

import { buildOutsideInRailTriangles, RAIL_SIDE, RAIL_STEP } from './dalAppNavRail';

const SQRT3 = Math.sqrt(3);

export function DalAppNavRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const side = RAIL_SIDE;
  const innerWidth = (SQRT3 / 2) * side;
  const step = RAIL_STEP;
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
          {triangles.map((tri, i) => (
            <polygon
              key={i}
              points={tri.points}
              fill={tri.outline ? 'none' : 'currentColor'}
              stroke={tri.outline ? 'currentColor' : 'none'}
              strokeWidth={tri.outline ? strokeWidth : 0}
              strokeLinejoin="miter"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
