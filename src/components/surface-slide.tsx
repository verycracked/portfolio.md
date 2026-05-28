"use client";

import { useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Props = {
  /** Ordered list of surface slugs — drives slide direction. The Overview
   *  view (the project's main page, no surface segment) is treated as
   *  position 0; surfaces follow in tab order. */
  orderedSurfaceSlugs: string[];
  /** Project slug from the route, used to detect whether the current URL
   *  is the Overview or a specific surface. */
  projectSlug: string;
  children: React.ReactNode;
};

/**
 * Sliding container for the surface body. Lives inside
 * `/projects/[slug]/layout.tsx` and wraps `{children}` (the page).
 *
 * When the surface slug changes, the current body slides off-screen in
 * the direction the user is travelling along the tab bar; the next body
 * slides in from the opposite edge. Direction follows tab order: moving
 * to a tab to the right slides the new body in from the right; moving
 * left, from the left.
 *
 * Reduced-motion users get a plain opacity crossfade.
 */
export function SurfaceSlide({
  orderedSurfaceSlugs,
  projectSlug,
  children,
}: Props) {
  const pathname = usePathname() ?? "";
  const reducedMotion = useReducedMotion();

  // Resolve "what slug is the page on" from the pathname. The Overview
  // route is `/projects/[slug]` (no surface segment) and we represent it
  // with an empty key in the ordered list below so direction math has a
  // consistent anchor at position 0.
  const currentSlug = useMemo(() => {
    const overviewPath = `/projects/${projectSlug}`;
    if (pathname === overviewPath || pathname === `${overviewPath}/`) {
      return "";
    }
    const tail = pathname.slice(overviewPath.length + 1);
    return tail.split("/")[0] ?? "";
  }, [pathname, projectSlug]);

  // Lookup index of the current slug in the ordered list (Overview = 0).
  const orderKey = useMemo(
    () => ["", ...orderedSurfaceSlugs.filter((s) => s !== "overview")],
    [orderedSurfaceSlugs]
  );
  const currentIndex = Math.max(0, orderKey.indexOf(currentSlug));

  // Compare to previous index to decide slide direction. First mount
  // (prev === null) emits 0 so the initial paint doesn't animate.
  const prevIndexRef = useRef<number | null>(null);
  let direction = 0;
  if (prevIndexRef.current !== null) {
    direction = currentIndex > prevIndexRef.current ? 1 : -1;
  }
  prevIndexRef.current = currentIndex;

  const distance = 24; // px — subtle, not a swiped-away page

  return (
    <div className="relative w-full overflow-x-clip">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentSlug || "__overview__"}
          initial={
            reducedMotion
              ? { opacity: 0 }
              : { opacity: 0, x: direction * distance }
          }
          animate={{ opacity: 1, x: 0 }}
          exit={
            reducedMotion
              ? { opacity: 0 }
              : { opacity: 0, x: -direction * distance }
          }
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
