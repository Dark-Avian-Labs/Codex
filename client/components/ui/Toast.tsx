type ToastTone = 'success' | 'error' | 'warning';

export function Toast({
  message,
  tone = 'error',
  onDismiss,
}: {
  message: string | null;
  tone?: ToastTone;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      className="toast-pill"
      data-tone={tone}
      data-interactive={onDismiss ? '' : undefined}
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      {message}
    </div>
  );
}
