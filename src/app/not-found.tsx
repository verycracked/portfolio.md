import Link from "next/link";
import ParticlesShader from "@/components/particles-shader";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[calc(100dvh-1rem)] items-center justify-center overflow-hidden px-6">
      <ParticlesShader contained theme="dark" />
      {/* Foreground text — kept minimal so the particle assembly is the
          star. Sits at the bottom-center so the VC mark in the canvas has
          room to breathe in the middle of the viewport. */}
      <div className="pointer-events-none relative z-10 mb-12 mt-auto flex flex-col items-center gap-3 text-center">
        <p className="text-[12px] uppercase tracking-[0.18em] text-tertiary">
          404 — Page not found
        </p>
        <Link
          href="/"
          className="pointer-events-auto text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
