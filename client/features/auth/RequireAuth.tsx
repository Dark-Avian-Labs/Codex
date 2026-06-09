import { Show } from '@clerk/react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { AccountRequiredPage } from './AccountRequiredPage';
import { safeAuthRedirectPath } from './authRedirect';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const returnTo =
    safeAuthRedirectPath(`${location.pathname}${location.search}${location.hash}`) ?? '/';

  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <AccountRequiredPage returnTo={returnTo} />
      </Show>
    </>
  );
}
