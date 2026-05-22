import { Show } from '@clerk/react';
import { Navigate } from 'react-router-dom';

import { AccountRequiredPage } from './AccountRequiredPage';

export function CodexLandingPage() {
  return (
    <>
      <Show when="signed-in">
        <Navigate to="/home" replace />
      </Show>
      <Show when="signed-out">
        <AccountRequiredPage />
      </Show>
    </>
  );
}
