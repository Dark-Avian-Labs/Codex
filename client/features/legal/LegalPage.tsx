import { useEffect } from 'react';

export function LegalPage() {
  useEffect(() => {
    window.location.replace('/auth/legal');
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
