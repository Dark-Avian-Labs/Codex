import { useStaleBundlePrompt } from '../../hooks/useStaleBundlePrompt';

type StaleClientUpdateBannerProps = {
  appVersion: string;
};

export function StaleClientUpdateBanner({ appVersion }: StaleClientUpdateBannerProps) {
  const bundleStale = useStaleBundlePrompt(appVersion);

  if (!bundleStale) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-[100] sm:inset-x-auto sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      role="status"
      aria-live="polite"
    >
      <div className="stale-update-banner pointer-events-auto ml-auto flex w-fit max-w-full items-center gap-3 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-2 pr-4 backdrop-blur-xl backdrop-saturate-150">
        <button
          type="button"
          className="stale-update-cta shrink-0"
          onClick={() => {
            window.location.reload();
          }}
        >
          <span className="stale-update-cta__label">Refresh</span>
        </button>
        <p className="text-foreground pr-1 text-sm font-medium tracking-tight">
          Client out of date
        </p>
      </div>
    </div>
  );
}
