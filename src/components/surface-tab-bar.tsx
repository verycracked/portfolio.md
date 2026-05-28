"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { usePreviewing } from "@/lib/preview";

type TabItem = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  mode: "link";
  projectSlug: string;
  surfaces: TabItem[];
  /** Optional override. If omitted, the bar derives the active slug
   *  from the URL — which is what the shared layout relies on so the
   *  active state stays in sync as the user clicks through tabs. */
  activeSlug?: string;
};

/** The Overview tab maps to the project detail page itself rather than
 *  to `/projects/[slug]/overview` — that keeps the main page and the
 *  Overview surface from feeling like two separate views. Non-overview
 *  surfaces keep their nested URL. */
function hrefFor(projectSlug: string, slug: string, previewing: boolean) {
  const base =
    slug === "overview"
      ? `/projects/${projectSlug}`
      : `/projects/${projectSlug}/${slug}`;
  return previewing ? `${base}?preview=1` : base;
}

function activeFromPath(pathname: string, projectSlug: string): string {
  const overviewPath = `/projects/${projectSlug}`;
  if (pathname === overviewPath || pathname === `${overviewPath}/`) {
    return "overview";
  }
  if (!pathname.startsWith(`${overviewPath}/`)) return "overview";
  return pathname.slice(overviewPath.length + 1).split("/")[0] || "overview";
}

/**
 * Surface tab bar used on the public project page. Each tab is a real
 * Next.js <Link> so the route actually changes, but the active state is
 * tracked optimistically on click: the indicator moves the moment the
 * user clicks, well before the new server component finishes streaming.
 *
 * Derives the active slug from the URL by default, so the bar stays in
 * sync as the user navigates inside the shared /projects/[slug] layout
 * (where the bar itself never unmounts).
 */
export function SurfaceTabBar({
  projectSlug,
  surfaces,
  activeSlug,
}: Props) {
  const pathname = usePathname() ?? "";
  const urlActive = useMemo(
    () => activeFromPath(pathname, projectSlug),
    [pathname, projectSlug]
  );
  const previewing = usePreviewing();

  const resolvedActive = activeSlug ?? urlActive;

  // Optimistic active slug — used so the indicator can jump immediately
  // on click instead of waiting for the route transition to finish.
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Clear the optimistic state once the URL catches up.
  const displayActive =
    pending && pending !== resolvedActive ? pending : resolvedActive;

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
              if (surface.slug === resolvedActive) return;
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
