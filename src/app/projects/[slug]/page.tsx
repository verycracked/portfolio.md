import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowUpRight, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { isAuthed } from "@/lib/auth";
import { isProjectUnlocked } from "@/lib/project-auth";
import { prisma } from "@/lib/prisma";
import { ChildGallery } from "@/components/child-gallery";
import { ProjectHero } from "@/components/project-hero";
import { ProjectHeroFrame } from "@/components/project-hero-frame";
import { OwnerToolbar } from "@/components/owner-toolbar";
import { SurfaceTabBar } from "@/components/surface-tab-bar";
import { ProjectUnlock } from "@/components/project-unlock";
import { SkeletonImage } from "@/components/skeleton-image";
import { FadeIn } from "@/components/fade-in";
import { isVideoUrl } from "@/lib/media";
import type { GalleryProject } from "@/components/gallery-types";

/** Prepend `https://` if the owner saved a bare hostname like
 *  "example.com/path" — keeps `<a href>` from staying same-origin. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("mailto:")) return trimmed;
  return `https://${trimmed}`;
}

/** Show a clean hostname for the source-url link. Falls back to the raw
 *  string when URL parsing fails on the (now normalized) input. */
function sourceUrlLabel(raw: string): string {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, "");
  } catch {
    return raw.trim();
  }
}

/**
 * Public project detail page. Shows the parent's hero + name +
 * description, and below it a single-bento `<ChildGallery>` of any
 * sub-projects. Owners get the same drag-reorder / resize / upload chrome
 * on the sub-grid that they have on the homepage. Visitors see a static
 * read-only grid.
 *
 * Password-protected projects gate behind `<ProjectUnlock>` for visitors.
 */
export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      // Drives the tab bar at the top of the page. Every project ships
      // with an "overview" surface; additional surfaces are owner-added.
      surfaces: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, slug: true, name: true },
      },
      children: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          heroImageUrl: true,
          posterUrl: true,
          hasAudio: true,
          isOpenable: true,
          passwordHash: true,
          colSpan: true,
          rowSpan: true,
          _count: { select: { children: true } },
        },
      },
    },
  });
  if (!project) notFound();

  const owner = await isAuthed();
  const isProtected = !!project.passwordHash;
  const unlocked = isProtected ? await isProjectUnlocked(project.id) : true;
  const previewing = preview === "1";

  // Media tiles aren't addressable — only promoted projects (isOpenable
  // or has children) have a meaningful detail page. Visitors landing on
  // a media-tile slug get bounced home; owners (not previewing) can still
  // see the page so they can promote / edit the tile.
  const isMediaTile =
    !project.isOpenable && project.children.length === 0;
  if (isMediaTile && (!owner || previewing)) {
    redirect(previewing ? "/?preview=1" : "/");
  }

  if (isProtected && !owner && !unlocked) {
    return (
      <ProjectUnlock
        projectId={project.id}
        title={project.title}
        description={project.description}
      />
    );
  }

  const childGalleryData: GalleryProject[] = project.children.map(
    ({ passwordHash, _count, ...rest }) => ({
      ...rest,
      isProtected: !!passwordHash,
      childCount: _count.children,
    })
  );

  const heroIsVideo = !!project.heroImageUrl && isVideoUrl(project.heroImageUrl);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      {owner && <OwnerToolbar previewing={previewing} />}
      {/* Back affordance — always present so visitors have a clear way out. */}
      <FadeIn>
        <Link
          href={previewing ? "/?preview=1" : "/"}
          className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          <ArrowLeft size={11} weight="bold" aria-hidden />
          Back
        </Link>
      </FadeIn>

      {/* Surface tabs — only render when the owner has added a custom
          surface beyond the default Overview. Overview routes back to
          this same page; the others jump to /projects/[slug]/[surface]. */}
      {project.surfaces.length > 1 && (
        <div
          className="animate-fade-rise mt-6"
          style={{ ["--reveal-delay" as string]: "20ms" }}
        >
          <SurfaceTabBar
            mode="link"
            projectSlug={project.slug}
            activeSlug="overview"
            surfaces={project.surfaces}
            previewing={previewing}
          />
        </div>
      )}

      {/* Hero — the project's cover, full-bleed across the content area.
          Image and video heroes both render in a fixed 16:10 frame with
          `object-fit: cover`; the owner can drag image heroes vertically
          to pan into the right framing (persisted as `heroOffsetY`). */}
      {project.heroImageUrl && (
        <div
          className="animate-fade-rise mt-6 overflow-hidden rounded-[6px] border border-border"
          style={{ ["--reveal-delay" as string]: "40ms" }}
        >
          {heroIsVideo ? (
            <div className="relative aspect-[16/10] bg-hover">
              <ProjectHero
                src={project.heroImageUrl}
                posterUrl={project.posterUrl ?? null}
                ariaLabel={project.title}
              />
            </div>
          ) : (
            <ProjectHeroFrame
              projectId={project.id}
              src={project.heroImageUrl}
              alt={project.title}
              initialOffsetY={project.heroOffsetY ?? 50}
              owner={owner && !previewing}
            />
          )}
        </div>
      )}

      {/* Title + description + optional source link */}
      <header
        className="animate-fade-rise mt-8 flex flex-col gap-2"
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">
          {project.title || "Untitled media tile"}
        </h1>
        {project.description && (
          <p className="max-w-3xl text-[14px] text-muted">
            {project.description}
          </p>
        )}
        {project.sourceUrl && (
          <a
            href={normalizeUrl(project.sourceUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 self-start text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            {sourceUrlLabel(project.sourceUrl)}
            <ArrowUpRight size={11} weight="bold" aria-hidden />
          </a>
        )}
        {owner && !previewing && (
          <div className="mt-3 flex items-center gap-3 text-[11px]">
            <Link
              href={`/edit/${project.id}`}
              className="text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Edit
            </Link>
            <Link
              href={`/projects/${project.slug}?preview=1`}
              className="text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Preview as visitor
            </Link>
          </div>
        )}
      </header>

      {/* Sub-projects grid — single bento, identical chrome to the
          homepage gallery. Hidden for visitors when empty; owner mode
          always renders so the "+ Upload" tile is reachable. */}
      {(owner && !previewing) || childGalleryData.length > 0 ? (
        <section
          className="animate-fade-rise mt-16 scroll-mt-8"
          style={{ ["--reveal-delay" as string]: "160ms" }}
        >
          <ChildGallery
            parentId={project.id}
            initial={childGalleryData}
            owner={owner}
            previewing={previewing}
          />
        </section>
      ) : null}
    </main>
  );
}
