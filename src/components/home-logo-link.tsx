"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "@phosphor-icons/react/dist/ssr";
import { usePreviewing, withPreview } from "@/lib/preview";

/**
 * Top-left VC mark. On a non-`/` route it's a plain `<Link href="/">`. On
 * `/` it scrolls the inner scroll container (`#app-scroll`) back to the
 * top — so the same control covers both "home" and "back to top".
 *
 * When the homepage is actually scrolled past the start and the cursor is
 * hovering the mark, the logo swaps to an up-arrow glyph so the affordance
 * is legible: "you can click this to go up." Crossfade is short (160ms) to
 * keep it from feeling fussy.
 */
export function HomeLogoLink() {
  const pathname = usePathname();
  const previewing = usePreviewing();
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el =
      typeof document !== "undefined"
        ? document.getElementById("app-scroll")
        : null;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 80);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const showArrow = pathname === "/" && scrolled && hovered;

  return (
    <Link
      href={withPreview("/", previewing)}
      aria-label={showArrow ? "Back to top" : "portfolio.md home"}
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute left-6 top-6 z-20 hidden h-6 w-7 items-center justify-center md:inline-flex"
    >
      <span className="relative block h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/vc-logo.svg"
          alt=""
          className={
            "absolute inset-0 h-full w-full transition-opacity duration-150 " +
            (showArrow ? "opacity-0" : "opacity-100")
          }
        />
        <span
          className={
            "absolute inset-0 flex items-center justify-center text-fg transition-opacity duration-150 " +
            (showArrow ? "opacity-100" : "opacity-0")
          }
          aria-hidden
        >
          <ArrowUp size={18} weight="bold" />
        </span>
      </span>
    </Link>
  );
}
