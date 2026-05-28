"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Collapse a pathname to a transition key. Most routes key on the full
 * path, so navigating between top-level pages does the dissolve. The
 * project subtree (`/projects/[slug]` and its surface children) collapse
 * to a single key per project so switching between Overview and a
 * surface tab does NOT trigger the root-level dissolve — that's handled
 * locally by SurfaceSlide inside the shared project layout.
 */
function transitionKeyFor(pathname: string): string {
  if (pathname.startsWith("/projects/")) {
    // /projects/SLUG[/SURFACE...] → /projects/SLUG
    const parts = pathname.split("/");
    // ["", "projects", "SLUG", ...] → slice(0, 3) keeps first three
    return parts.slice(0, 3).join("/");
  }
  return pathname;
}

/**
 * Wraps children in a pure-opacity dissolve transition keyed by a
 * collapsed pathname. No translation — clean crossfade-style fade-out
 * → fade-in so navigating between routes feels like the new page
 * dissolves into place.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const key = transitionKeyFor(pathname);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: "linear" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
