import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

export function GlassCard({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          'border border-[var(--color-glass-border)] bg-[var(--color-glass)] shadow-[var(--shadow-panel)] backdrop-blur [border-radius:var(--radius-ui-lg)]',
          className,
        ),
      )}
      {...props}
    />
  );
}
