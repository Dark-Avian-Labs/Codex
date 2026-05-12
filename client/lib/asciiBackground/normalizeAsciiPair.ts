export function normalizeAsciiPair(
  a: string[],
  b: string[],
): {
  base: string[];
  alt: string[];
} {
  const h = Math.max(a.length, b.length);
  const w = Math.max(0, ...a.map((r) => r.length), ...b.map((r) => r.length));
  const padRow = (r: string) => r.padEnd(w, ' ');
  const base = Array.from({ length: h }, (_, i) => padRow(a[i] ?? ''));
  const alt = Array.from({ length: h }, (_, i) => padRow(b[i] ?? ''));
  return { base, alt };
}
