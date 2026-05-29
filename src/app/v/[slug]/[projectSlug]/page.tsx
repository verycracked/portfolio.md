import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isVideoUrl } from "@/lib/media";
import { ProjectHeroFrame } from "@/components/project-hero-frame";
import { ProjectHero } from "@/components/project-hero";
import { FadeIn } from "@/components/fade-in";

/**
 * View-scoped project detail page at `/v/[viewSlug]/[projectSlug]`.
 * Renders the ViewProject's hero + title + description. Allows the
 * owner to see and verify the tile's content without leaving the
 * view's URL namespace.
 *
 * If the ViewProject has a `sourceProjectId`, links through to the
 * canonical project's surfaces / sub-projects via a "View full project"
 * link. Otherwise renders what we have on the ViewProject itself.
 */
export default async function ViewProjectPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug: viewSlug, projectSlug } = await params;

  const view = await prisma.view.findUnique({
    where: { slug: viewSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!view) notFound();

  const viewProject = await prisma.viewProject.findUnique({
    where: { viewId_slug: { viewId: view.id, slug: projectSlug } },
    include: {
      sourceProject: {
        select: {
          slug: true,
          title: true,
          description: true,
          sourceUrl: true,
          heroImageUrl: true,
          posterUrl: true,
          heroOffsetY: true,
        },
      },
    },
  });
  if (!viewProject) notFound();

  const owner = await isAuthed();

  // Prefer the view project's own fields; fall back to the canonical
  // source for anything the view row doesn't override.
  const title = viewProject.title || viewProject.sourceProject?.title || "";
  const description =
    viewProject.description || viewProject.sourceProject?.description || "";
  const heroImageUrl =
    viewProject.heroImageUrl ?? viewProject.sourceProject?.heroImageUrl ?? null;
  const posterUrl =
    viewProject.posterUrl ?? viewProject.sourceProject?.posterUrl ?? null;
  const heroOffsetY =
    viewProject.heroOffsetY ?? viewProject.sourceProject?.heroOffsetY ?? 50;
  const sourceUrl =
    viewProject.sourceUrl ?? viewProject.sourceProject?.sourceUrl ?? null;

  const heroIsVideo = !!heroImageUrl && isVideoUrl(heroImageUrl);

  /** Prepend https:// if missing. */
  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/") || trimmed.startsWith("mailto:")) return trimmed;
    return `https://${trimmed}`;
  }

  function sourceUrlLabel(raw: string): string {
    try {
      return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, "");
    } catch {
      return raw.trim();
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      <FadeIn>
        <Link
          href={owner ? `/v/${viewSlug}/edit` : `/v/${viewSlug}`}
          className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          <ArrowLeft size={11} weight="bold" aria-hidden />
          Back to {view.name}
        </Link>
      </FadeIn>

      {heroImageUrl && (
        <div
          className="animate-fade-rise mt-6 overflow-hidden rounded-[6px] border border-border"
          style={{ ["--reveal-delay" as string]: "40ms" }}
        >
          {heroIsVideo ? (
            <div className="relative aspect-[16/10] bg-hover">
              <ProjectHero
                src={heroImageUrl}
                posterUrl={posterUrl}
                ariaLabel={title}
              />
            </div>
          ) : (
            <ProjectHeroFrame
              projectId={viewProject.id}
              src={heroImageUrl}
              alt={title}
              initialOffsetY={heroOffsetY}
              owner={false}
            />
          )}
        </div>
      )}

      <header
        className="animate-fade-rise mt-8 flex flex-col gap-2"
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">
          {title || "Untitled"}
        </h1>
        {description && (
          <p className="max-w-3xl text-[14px] text-muted">{description}</p>
        )}
        {sourceUrl && (
          <a
            href={normalizeUrl(sourceUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 self-start text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            {sourceUrlLabel(sourceUrl)}
            <ArrowUpRight size={11} weight="bold" aria-hidden />
          </a>
        )}
        {/* Link to the canonical project's full detail page if this view
            tile was seeded from one — gives access to surfaces, sub-projects,
            and the project editor. */}
        {viewProject.sourceProject && (
          <Link
            href={`/projects/${viewProject.sourceProject.slug}`}
            className="mt-2 inline-flex items-center gap-1 self-start text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            View full project
            <ArrowUpRight size={11} weight="bold" aria-hidden />
          </Link>
        )}
      </header>
    </main>
  );
}
