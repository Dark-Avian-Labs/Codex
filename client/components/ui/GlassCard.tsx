import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  const classes = ['glass-surface'];
  if (className) {
    classes.push(className);
  }
  return <section className={classes.join(' ')}>{children}</section>;
}
