/**
 * Shared client-side utilities.
 * Imported by all game entry points; Vite deduplicates into a single chunk.
 */

/**
 * Escape a string for safe insertion as HTML *text content*.
 * Handles &, <, >, ", and '.
 */
export function escapeHtml(str) {
  const s = str == null ? '' : String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a string for safe insertion inside an HTML *attribute value*
 * (double-quoted). Identical to escapeHtml but named for intent clarity;
 * both cover the required characters (&, <, >, ", ').
 */
export const escapeAttr = escapeHtml;

/**
 * Returns a debounced version of `fn` that delays invocation until `ms`
 * milliseconds have elapsed since the last call.
 */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
