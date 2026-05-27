"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top-left VC mark. Behaves like a normal `<Link href="/">` on any page
 * other than the homepage; on `/` itself it instead scrolls the inner
 * scroll container (the one inside the fixed border frame, id=app-scroll)
 * back to the top with a smooth animation. That way the chrome's "home"
 * affordance is also the "back to top" affordance — no second control.
 */
export function HomeLogoLink() {
  const pathname = usePathname();

  return (
    <Link
      href="/"
      aria-label="portfolio.md home"
      onClick={(e) => {
        if (pathname !== "/") return;
        e.preventDefault();
        const el =
          typeof document !== "undefined"
            ? document.getElementById("app-scroll")
            : null;
        if (!el) return;
        el.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="absolute left-6 top-6 z-20 hidden h-6 w-7 items-center justify-center md:inline-flex"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/vc-logo.svg" alt="" className="h-full w-full" />
    </Link>
  );
}
