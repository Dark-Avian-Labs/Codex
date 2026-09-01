import { useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useLayoutSlots } from './useLayoutSlots';

export function CollectionSubheader({ children }: { children: ReactNode }) {
  const { subheaderTarget, setCollectionFill } = useLayoutSlots();

  useLayoutEffect(() => {
    if (!subheaderTarget) return undefined;
    setCollectionFill(true);
    return () => {
      setCollectionFill(false);
    };
  }, [setCollectionFill, subheaderTarget]);

  if (!subheaderTarget) return null;
  return createPortal(children, subheaderTarget);
}
