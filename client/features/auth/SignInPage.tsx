import { ClerkAuthShell } from '@/components/ClerkAuthShell';
import { useTheme } from '@/context/ThemeContext';
import { buildClerkAppearance } from '@/lib/clerkAppearance';
import { SignIn } from '@clerk/react';
import { Navigate } from 'react-router-dom';

import { getAuthFallbackRedirect } from './authRedirect';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function SignInPage() {
  const { mode } = useTheme();

  if (!publishableKey) {
    return <Navigate to="/" replace />;
  }

  return (
    <ClerkAuthShell
      title="Sign in to Codex"
      subtitle="Track Warframe and Epic Seven progress with your Dark Avian Labs account."
    >
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={getAuthFallbackRedirect()}
        appearance={buildClerkAppearance(mode)}
      />
    </ClerkAuthShell>
  );
}
