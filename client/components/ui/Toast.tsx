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
    >
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="toast-dismiss" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  );
}
