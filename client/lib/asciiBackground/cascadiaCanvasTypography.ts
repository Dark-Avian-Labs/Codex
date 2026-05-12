export const CASCADIA_FONT_STACK = '"Cascadia Mono", monospace';

export type FontStretchOption =
  | 'normal'
  | 'ultra-condensed'
  | 'extra-condensed'
  | 'condensed'
  | 'semi-condensed'
  | 'semi-expanded'
  | 'expanded'
  | 'extra-expanded'
  | 'ultra-expanded';

export type CascadiaCanvasTypography = {
  fontSizePx: number;
  lineHeightPx: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fontStretch: FontStretchOption;
  letterSpacingPx: number;
  wordSpacingPx: number;
  fontKerning: 'auto' | 'normal' | 'none';
  textRendering: 'auto' | 'optimizeSpeed' | 'optimizeLegibility' | 'geometricPrecision';
  fontVariantCaps: 'normal' | 'small-caps' | 'all-small-caps' | 'petite-caps' | 'all-petite-caps';
  textDirection: 'ltr' | 'rtl' | 'inherit';
};

export const DEFAULT_CASCADIA_TYPOGRAPHY: CascadiaCanvasTypography = {
  fontSizePx: 11,
  lineHeightPx: 13,
  fontWeight: 400,
  fontStyle: 'normal',
  fontStretch: 'normal',
  letterSpacingPx: 0,
  wordSpacingPx: 0,
  fontKerning: 'auto',
  textRendering: 'auto',
  fontVariantCaps: 'normal',
  textDirection: 'ltr',
};

export function buildCascadiaFontString(t: CascadiaCanvasTypography): string {
  const parts: string[] = [];
  if (t.fontVariantCaps !== 'normal') {
    parts.push(t.fontVariantCaps);
  }
  if (t.fontStyle !== 'normal') {
    parts.push(t.fontStyle);
  }
  if (t.fontStretch !== 'normal') {
    parts.push(t.fontStretch);
  }
  parts.push(String(t.fontWeight));
  parts.push(`${t.fontSizePx}px/${t.lineHeightPx}px`);
  parts.push(CASCADIA_FONT_STACK);
  return parts.join(' ');
}

export function applyCascadiaTypographyToContext(
  ctx: CanvasRenderingContext2D,
  t: CascadiaCanvasTypography,
): void {
  ctx.direction = t.textDirection;
  ctx.font = buildCascadiaFontString(t);
  ctx.textBaseline = 'top';
  ctx.letterSpacing = `${t.letterSpacingPx}px`;
  ctx.wordSpacing = `${t.wordSpacingPx}px`;
  ctx.fontKerning = t.fontKerning;
  ctx.textRendering = t.textRendering;
  ctx.fontVariantCaps = t.fontVariantCaps;
}
