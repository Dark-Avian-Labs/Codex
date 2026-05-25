export function LazySuspenseFallback() {
  return (
    <div
      className="flex min-h-[120px] items-center justify-center p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-atomic="true"
    >
      <p className="text-muted text-sm">Loading...</p>
    </div>
  );
}
