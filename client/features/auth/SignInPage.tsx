import { ClerkAuthShell } from '@/components/ClerkAuthShell';
import { useTheme } from '@/context/ThemeContext';
import { buildClerkAppearance } from '@/lib/clerkAppearance';
import { SignIn } from '@clerk/react';
import { Navigate, useSearchParams } from 'react-router-dom';

import { getAuthRedirectUrl } from './authRedirect';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function SignInPage() {
  const { mode } = useTheme();
  const [searchParams] = useSearchParams();
  const redirectUrl = getAuthRedirectUrl(searchParams);

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
        fallbackRedirectUrl={redirectUrl}
        appearance={buildClerkAppearance(mode)}
      />
    </ClerkAuthShell>
  );
}
