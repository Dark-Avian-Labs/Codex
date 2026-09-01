import type { ReactNode } from 'react';

import type { FilterTriState } from '../../lib/triFilter';

type FilterIconButtonProps = {
  state: FilterTriState;
  label: string;
  onClick: () => void;
  children: ReactNode;
};

function titleFor(label: string, state: FilterTriState): string {
  if (state === 'include') return `${label} (include)`;
  if (state === 'exclude') return `${label} (exclude)`;
  return label;
}

function ariaLabelFor(label: string, state: FilterTriState): string {
  if (state === 'include') return `Showing only ${label}`;
  if (state === 'exclude') return `Hiding ${label}`;
  return `Filter by ${label}`;
}

export function FilterIconButton({ state, label, onClick, children }: FilterIconButtonProps) {
  let className = 'filter-icon';
  if (state === 'include') {
    className = 'filter-icon active';
  } else if (state === 'exclude') {
    className = 'filter-icon exclude';
  }

  return (
    <button
      type="button"
      className={className}
      title={titleFor(label, state)}
      aria-pressed={state !== 'off'}
      aria-label={ariaLabelFor(label, state)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
