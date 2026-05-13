"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[calc(100vh-1rem)] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[12px] text-tertiary">Error</p>
        <h1 className="mt-2 text-[16px] font-semibold text-fg">Something broke.</h1>
        <p className="mt-3 text-[12px] text-muted">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-[6px] bg-fg px-3 py-2 text-[12px] font-medium text-content"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
