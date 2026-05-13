import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-1rem)] items-center justify-center px-6">
      <div className="text-center">
        <p className="text-[12px] text-tertiary">404</p>
        <h1 className="mt-2 text-[16px] font-semibold text-fg">Nothing here.</h1>
        <Link
          href="/"
          className="mt-6 inline-block text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
