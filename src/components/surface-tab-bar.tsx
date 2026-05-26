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
};

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
            href={`/projects/${projectSlug}/${surface.slug}`}
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
