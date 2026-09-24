export type RailTriangle = {
  points: string;
  outline: boolean;
  /** Tip points into the page (`>`). The return chevron points back out (`<`). */
  pointsIn: boolean;
};

const OUTLINE_CHANCE = 0.28;

export const RAIL_SIDE = 10;
export const RAIL_STEP = RAIL_SIDE + 6;

/** Height of a closed handle that contains exactly `count` triangles. */
export function closedRailHeight(count = 5, side = RAIL_SIDE, step = RAIL_STEP): number {
  const half = side / 2;
  let height = 0;
  for (let i = 0; i < count; i += 1) {
    const n = Math.floor(i / 2);
    const cy = i % 2 === 0 ? half + n * step : half + step / 2 + n * step;
    height = cy + half;
  }
  return height;
}

export const CLOSED_RAIL_MIN_HEIGHT = closedRailHeight();

function hashUnit(index: number, salt: number): number {
  const n = Math.imul((index + 1) ^ salt, 2654435761) >>> 0;
  return (n % 10000) / 10000;
}

/** Column of chevrons. The top triangle always starts on the outer edge and points in. */
export function buildOutsideInRailTriangles(
  height: number,
  x0: number,
  x1: number,
  side: number,
  step: number,
  salt: number,
): RailTriangle[] {
  if (height < side) return [];

  const triangles: RailTriangle[] = [];
  const half = side / 2;
  let index = 0;

  const push = (points: string, pointsIn: boolean) => {
    triangles.push({
      points,
      outline: hashUnit(index, salt) < OUTLINE_CHANCE,
      pointsIn,
    });
    index += 1;
  };

  for (let cy = half; cy + half <= height + 0.01; cy += step) {
    push(`${x0},${cy - half} ${x0},${cy + half} ${x1},${cy}`, true);
  }

  for (let cy = half + step / 2; cy + half <= height + 0.01; cy += step) {
    push(`${x1},${cy - half} ${x1},${cy + half} ${x0},${cy}`, false);
  }

  triangles.sort((a, b) => {
    const top = (points: string) => Number(points.split(' ')[0]?.split(',')[1]);
    return top(a.points) - top(b.points);
  });

  return triangles;
}
