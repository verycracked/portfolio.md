"use client";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 dark:bg-stone-950">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-widest text-rose-500">error</p>
        <h1 className="mt-2 text-2xl">something broke.</h1>
        <p className="mt-3 text-sm text-stone-500">{error.message}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-stone-900 px-4 py-2 text-sm text-white dark:bg-stone-100 dark:text-stone-900"
        >
          try again
        </button>
      </div>
    </main>
  );
}
