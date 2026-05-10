import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 dark:bg-stone-950">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-stone-400">404</p>
        <h1 className="mt-2 text-2xl">nothing here.</h1>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-stone-600 underline-offset-2 hover:underline dark:text-stone-300"
        >
          go home
        </Link>
      </div>
    </main>
  );
}
