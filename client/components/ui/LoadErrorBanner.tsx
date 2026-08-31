export function LoadErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error flex items-center justify-between gap-3" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
