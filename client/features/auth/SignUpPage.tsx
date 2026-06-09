import { ClerkAuthShell } from '@/components/ClerkAuthShell';
import { useTheme } from '@/context/ThemeContext';
import { buildClerkAppearance } from '@/lib/clerkAppearance';
import { SignUp } from '@clerk/react';
import { Navigate, useSearchParams } from 'react-router-dom';

import { getAuthRedirectUrl } from './authRedirect';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function SignUpPage() {
  const { mode } = useTheme();
  const [searchParams] = useSearchParams();
  const redirectUrl = getAuthRedirectUrl(searchParams);

  if (!publishableKey) {
    return <Navigate to="/" replace />;
  }

  return (
    <ClerkAuthShell
      title="Create your account"
      subtitle="One account for Codex and Armory. We only store your user id in our apps."
    >
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl={redirectUrl}
        appearance={buildClerkAppearance(mode)}
      />
    </ClerkAuthShell>
  );
}
