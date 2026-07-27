import { useOutletContext } from 'react-router';

import type { LayoutOutletContext } from './Layout';

export function useLayoutSlots() {
  return useOutletContext<LayoutOutletContext>();
}
