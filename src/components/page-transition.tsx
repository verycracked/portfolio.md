"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Wraps children in a fade transition keyed by pathname.
 * Tasteful dissolve: 200ms opacity + 4px Y nudge, no exit overlap.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
