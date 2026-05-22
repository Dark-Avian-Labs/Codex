import { Show } from '@clerk/react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { AccountRequiredPage } from './AccountRequiredPage';

function safeRedirectPath(path: string): string {
  if (path.startsWith('/') && !path.startsWith('//') && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path)) {
    return path;
  }
  return '/';
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const returnTo = safeRedirectPath(`${location.pathname}${location.search}${location.hash}`);

  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <AccountRequiredPage returnTo={returnTo} />
      </Show>
    </>
  );
}
