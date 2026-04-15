import { useEffect } from 'react';

import { LEGAL_PAGE_URL } from '../../app/config';

export function LegalPage() {
  useEffect(() => {
    window.location.replace(LEGAL_PAGE_URL);
  }, []);

  return (
    <section className="mx-auto max-w-[900px] rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-6">
      <h1 className="mb-3 text-2xl font-semibold">Legal</h1>
      <p className="text-muted text-sm" role="status" aria-live="polite">
        Redirecting to legal information…
      </p>
    </section>
  );
}
