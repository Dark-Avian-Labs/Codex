import type { ReactNode } from 'react';

interface MenuProps {
  children: ReactNode;
  className?: string;
}

export function Menu({ children, className }: MenuProps) {
  const classes = ['user-menu', 'glass-surface'];
  if (className) classes.push(className);
  return <div className={classes.join(' ')}>{children}</div>;
}
