import { Link } from 'react-router-dom';

import { APP_PATHS } from '../../app/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <section className="mx-auto max-w-md space-y-3 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-8 text-center">
        <h1 className="text-foreground space-y-1">
          <span className="text-muted/80 block text-6xl leading-none font-bold">404</span>
          <span className="block text-xl font-semibold">Page not found</span>
        </h1>
        <p className="text-muted text-sm">We could not find the page you were looking for.</p>
        <Link
          to={APP_PATHS.home}
          className="text-accent hover:text-accent/80 mt-2 inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Go home
        </Link>
      </section>
    </div>
  );
}
