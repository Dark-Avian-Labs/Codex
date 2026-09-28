import { ClerkProvider } from '@clerk/react';
import { Outlet } from 'react-router';

import { APP_PATHS } from './app/paths';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AuthProvider } from './features/auth/AuthContext';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function App() {
  if (!publishableKey) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-muted text-sm">
          Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to your environment file to enable sign-in.
        </p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl={APP_PATHS.home}>
      <AuthProvider>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </AuthProvider>
    </ClerkProvider>
  );
}
