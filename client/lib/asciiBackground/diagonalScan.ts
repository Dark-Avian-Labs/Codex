export const SCAN_BAND_HALF = 0.01;
export const SCAN_BAND_FEATHER = 0.006;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1e-9)));
  return t * t * (3 - 2 * t);
}

export function cssLinearGradientT(
  col: number,
  row: number,
  cols: number,
  rows: number,
  angleDeg: number,
): number {
  const rad = (angleDeg * Math.PI) / 180;
  const gx = Math.sin(rad);
  const gy = -Math.cos(rad);

  const nx = cols <= 1 ? 0.5 : col / (cols - 1);
  const ny = rows <= 1 ? 0.5 : row / (rows - 1);

  let pmin = Infinity;
  let pmax = -Infinity;
  for (const x of [0, 1]) {
    for (const y of [0, 1]) {
      const pc = x * gx + y * gy;
      pmin = Math.min(pmin, pc);
      pmax = Math.max(pmax, pc);
    }
  }
  const p = nx * gx + ny * gy;
  const span = pmax - pmin || 1;
  return (p - pmin) / span;
}

export function altBlend(
  t: number,
  phase: number,
  half: number = SCAN_BAND_HALF,
  feather: number = SCAN_BAND_FEATHER,
): number {
  const d = Math.abs(t - phase);
  return 1 - smoothstep(half, half + feather, d);
}
