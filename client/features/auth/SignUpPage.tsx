import { ClerkAuthShell } from '@/components/ClerkAuthShell';
import { buildClerkAppearance } from '@/lib/clerkAppearance';
import { SignUp } from '@clerk/react';
import { Navigate } from 'react-router-dom';

import { APP_PATHS } from '../../app/paths';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export function SignUpPage() {
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
        fallbackRedirectUrl={APP_PATHS.warframe}
        appearance={buildClerkAppearance()}
      />
    </ClerkAuthShell>
  );
}
