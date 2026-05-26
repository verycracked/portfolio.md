/**
 * Plain opacity dissolve. Wraps children in a CSS-animated container that
 * starts at opacity 0 and eases to 1 over 700ms — so the entry reads as a
 * deliberate dissolve, not a snap.
 *
 * Pure CSS (no `"use client"`) so the SSR-rendered HTML starts at the
 * pre-animation state and the dissolve plays on the very first paint —
 * regardless of how fast hydration happens.
 */
export function FadeIn({ children }: { children: React.ReactNode }) {
  return <div className="animate-dissolve">{children}</div>;
}
