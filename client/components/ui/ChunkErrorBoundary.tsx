import { Component, type ErrorInfo, type ReactNode } from 'react';

type ChunkErrorBoundaryState = {
  hasError: boolean;
};

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk .* failed/i.test(error.message) ||
    /ChunkLoadError/i.test(error.message)
  );
}

function ChunkLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-muted text-sm">
        Something went wrong while loading this page. Please try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="border-border text-foreground hover:bg-secondary rounded-md border px-3 py-1.5 text-sm transition"
      >
        Retry
      </button>
    </div>
  );
}

export class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  ChunkErrorBoundaryState
> {
  public state: ChunkErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState | null {
    if (isChunkLoadError(error)) {
      return { hasError: true };
    }

    return null;
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isChunkLoadError(error)) {
      console.error('Chunk load failed', error, info);
      return;
    }

    throw error;
  }

  private handleRetry = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return <ChunkLoadError onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
