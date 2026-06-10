export function canvasDpiScale(devicePixelRatio = window.devicePixelRatio || 1): number {
  return Math.max(1, Math.ceil(devicePixelRatio));
}

export function snapAsciiCellWidth(ctx: CanvasRenderingContext2D, dpiScale: number): number {
  const raw = ctx.measureText('M').width;
  return Math.max(1, Math.round(raw * dpiScale) / dpiScale);
}
