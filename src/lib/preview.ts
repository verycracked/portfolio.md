"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Read the live `?preview=1` flag from the URL bar. Used everywhere we
 * render an internal link so the visitor-preview state survives
 * navigation (e.g. clicking a tile from a `?preview=1` homepage should
 * land on the project page still in preview mode).
 *
 * We deliberately avoid `useSearchParams()` here because it forces every
 * caller into a Suspense boundary and opts out of static prerendering.
 * Reading `window.location.search` after mount is sufficient: server +
 * first-paint render returns `false`, then we re-render on hydration
 * with the live value. Links re-render along with us, so the preserved
 * `?preview=1` is in place well before the user can click anything.
 */
export function usePreviewing(): boolean {
  // Re-evaluate on every route change so client-side nav between
  // `/?preview=1` and `/` (via the OwnerToolbar toggle) is reflected.
  const pathname = usePathname();
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPreviewing(
      new URLSearchParams(window.location.search).get("preview") === "1"
    );
  }, [pathname]);
  return previewing;
}

/**
 * Append `?preview=1` to an internal href when the current page is in
 * preview mode. No-op otherwise. Preserves any existing query string.
 */
export function withPreview(href: string, previewing: boolean): string {
  if (!previewing) return href;
  // Preserve hashes — split, append, rejoin.
  const [pathAndQuery, hash] = href.split("#");
  const joiner = pathAndQuery.includes("?") ? "&" : "?";
  const next = `${pathAndQuery}${joiner}preview=1`;
  return hash ? `${next}#${hash}` : next;
}
