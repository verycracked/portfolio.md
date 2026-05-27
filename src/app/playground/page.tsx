import type { Metadata } from "next";
import Link from "next/link";
import ParticlesShader from "@/components/particles-shader";

export const metadata: Metadata = {
  title: "Playground",
  // Hidden surface — keep search engines out so visitors only find it
  // when handed the URL directly.
  robots: { index: false, follow: false },
};

/**
 * Hidden /playground page — a quiet sandbox to host experimental shaders
 * and other one-off interactive bits. The fixed VC mark in the root layout
 * already routes back to `/`, so it doubles as the "go home" affordance.
 * A small inline back link surfaces the same action on touch viewports
 * where the logo is hidden.
 */
export default function PlaygroundPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh-1rem)] items-center justify-center overflow-hidden">
      <ParticlesShader contained theme="dark" />
      {/* Touch-friendly back link — the desktop logo at top-left already
          handles this on hover-capable devices. */}
      <Link
        href="/"
        className="pointer-events-auto absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[11px] uppercase tracking-[0.18em] text-tertiary underline-offset-4 hover:text-fg hover:underline md:hidden"
      >
        ← Back
      </Link>
    </main>
  );
}
