import { Link } from 'react-router-dom';

import { LEGAL_PAGE_URL } from '../../app/config';
import { APP_PATHS } from '../../app/paths';
import { buildAuthPagePath } from './authRedirect';

interface AccountRequiredPageProps {
  returnTo?: string;
}

export function AccountRequiredPage({ returnTo }: AccountRequiredPageProps) {
  const authRedirectUrl = returnTo && returnTo.startsWith('/') ? returnTo : APP_PATHS.warframe;
  const signUpPath = buildAuthPagePath(APP_PATHS.signUp, authRedirectUrl);
  const signInPath = buildAuthPagePath(APP_PATHS.signIn, authRedirectUrl);

  return (
    <div className="min-h-page-content mx-auto flex max-w-lg flex-col items-center justify-center px-6 py-12 text-center">
      <div className="glass-panel w-full p-8">
        <h1 className="text-foreground mb-3 text-2xl font-semibold tracking-tight">
          Sign in to use Codex
        </h1>
        <p className="text-muted mb-6 text-sm leading-relaxed">
          A Dark Avian Labs account is required to save Warframe and Epic Seven progress. Codex
          stores only your Clerk user id and game data — not your email or display name.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to={signUpPath} className="btn btn-accent w-full sm:w-auto">
            Create account
          </Link>
          <Link to={signInPath} className="btn btn-secondary w-full sm:w-auto">
            Sign in
          </Link>
        </div>
        <p className="text-muted mt-5 text-xs">
          Or go to{' '}
          <Link className="text-accent hover:underline" to={signUpPath}>
            sign up
          </Link>{' '}
          /{' '}
          <Link className="text-accent hover:underline" to={signInPath}>
            sign in
          </Link>
        </p>
        <p className="text-muted mt-6 text-xs">
          <a
            href={LEGAL_PAGE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Legal &amp; privacy
          </a>
        </p>
      </div>
    </div>
  );
}
