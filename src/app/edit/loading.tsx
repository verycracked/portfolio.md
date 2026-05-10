export default function EditLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-full bg-stone-100 dark:bg-stone-900" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-stone-100 dark:bg-stone-900" />
      </div>
      <div className="mb-3 h-8 w-2/3 animate-pulse rounded bg-stone-100 dark:bg-stone-900" />
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-stone-100 dark:bg-stone-900" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-stone-100 dark:bg-stone-900" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-stone-100 dark:bg-stone-900" />
      </div>
    </main>
  );
}
