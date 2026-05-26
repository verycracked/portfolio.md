"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Wraps children in a pure-opacity dissolve transition keyed by pathname.
 * No translation — clean crossfade-style fade-out → fade-in so navigating
 * between routes feels like the new page dissolves into place.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
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
