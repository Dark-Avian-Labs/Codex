import { useEffect } from 'react';

export function useAutoDismissMessage(
  message: string | null,
  clear: () => void,
  delayMs = 5000,
): void {
  useEffect(() => {
    if (!message) return undefined;
    const timeoutId = window.setTimeout(clear, delayMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, clear, delayMs]);
}
