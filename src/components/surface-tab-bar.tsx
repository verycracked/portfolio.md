import Link from "next/link";
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
 * Read-only surface tab bar used on the public project page. Each tab is a
 * Next.js <Link>, so navigation is a real route change. The active tab wears
 * the project-wide `.double-stroke` selection treatment (Paper-style): dark
 * hairline ring + soft drop shadow + a 1px inner radial highlight that rests
 * in the top-lit position. Inactive tabs are flat hover targets.
 */
export function SurfaceTabBar({
  projectSlug,
  surfaces,
  activeSlug,
  previewing,
}: Props) {
  return (
    <nav
      aria-label="Project surfaces"
      className="inline-flex flex-wrap items-center gap-1 rounded-[10px] border border-border-soft bg-content/60 p-1"
    >
      {surfaces.map((surface) => {
        const active = surface.slug === activeSlug;
        return (
          <Link
            key={surface.id}
            href={hrefFor(projectSlug, surface.slug, previewing)}
            aria-current={active ? "page" : undefined}
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
