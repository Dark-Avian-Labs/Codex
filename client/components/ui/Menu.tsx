import clsx from 'clsx';
import type { ReactNode } from 'react';

interface MenuProps {
  children: ReactNode;
  className?: string;
  baseClass?: string;
}

export function Menu({ children, className, baseClass = 'menu' }: MenuProps) {
  return (
    <div className={clsx(baseClass, 'glass-surface', className)}>
      {children}
    </div>
  );
}
