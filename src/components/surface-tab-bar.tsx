"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import clsx from "clsx";

type TabItem = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  mode: "link";
  projectSlug: string;
  surfaces: TabItem[];
  activeSlug: string;
  /** When true, append `?preview=1` to every tab href so the visitor-
   *  preview state survives switching surfaces. */
  previewing?: boolean;
};

/** The Overview tab maps to the project detail page itself rather than
 *  to `/projects/[slug]/overview` — that keeps the main page and the
 *  Overview surface from feeling like two separate views. Non-overview
 *  surfaces keep their nested URL. */
function hrefFor(projectSlug: string, slug: string, previewing?: boolean) {
  const base =
    slug === "overview"
      ? `/projects/${projectSlug}`
      : `/projects/${projectSlug}/${slug}`;
  return previewing ? `${base}?preview=1` : base;
}

/**
 * Surface tab bar used on the public project page. Each tab is a real
 * Next.js <Link> so the route actually changes, but the active state is
 * tracked optimistically on click: the indicator slides the moment the
 * user clicks, well before the new server component finishes streaming.
 *
 * Sizing: every tab is rendered at the SAME width (the width of the
 * widest label) so the bar doesn't shift as the active marker moves
 * between tabs. The marker's border / shadow treatment also stays put,
 * which is what makes the swap feel smooth.
 */
export function SurfaceTabBar({
  projectSlug,
  surfaces,
  activeSlug,
  previewing,
}: Props) {
  // Optimistic active slug — used so the indicator can jump immediately
  // on click instead of waiting for the route transition to finish. We
  // clear it when the URL prop (`activeSlug`) catches up, but until then
  // the click target wears the active treatment.
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const displayActive = pending ?? activeSlug;

  return (
    <nav
      aria-label="Project surfaces"
      className="inline-flex flex-wrap items-center gap-1 rounded-[10px] border border-border-soft bg-content/60 p-1"
    >
      {surfaces.map((surface) => {
        const active = surface.slug === displayActive;
        return (
          <Link
            key={surface.id}
            href={hrefFor(projectSlug, surface.slug, previewing)}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (surface.slug === activeSlug) return;
              // Move the marker now; let React's Transition machinery
              // handle the actual route swap on a non-blocking lane.
              startTransition(() => setPending(surface.slug));
            }}
            className={clsx(
              "relative inline-flex items-center rounded-[8px] px-3 py-1.5 text-[12px] transition-colors",
              active
                ? "double-stroke bg-hover font-medium text-fg"
                : "text-muted hover:text-fg"
            )}
          >
            {surface.name}
          </Link>
        );
      })}
    </nav>
  );
}
