import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { isAuthed } from "@/lib/auth";
import { isProjectUnlocked } from "@/lib/project-auth";
import { prisma } from "@/lib/prisma";
import { ProjectUnlock } from "@/components/project-unlock";
import { SurfaceTabBar } from "@/components/surface-tab-bar";
import { OwnerToolbar } from "@/components/owner-toolbar";
import { SurfaceHeroSlot } from "@/components/surface-hero-slot";
import { FadeIn } from "@/components/fade-in";
import { isVideoUrl } from "@/lib/media";

/** Prepend `https://` if the owner saved a bare hostname like
 *  "example.com/path" — keeps `<a href>` from staying same-origin. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") || trimmed.startsWith("mailto:")) return trimmed;
  return `https://${trimmed}`;
}

/** Hostname-only label for the source link. */
function sourceUrlLabel(raw: string): string {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, "");
  } catch {
    return raw.trim();
  }
}

/**
 * Surface detail page — `/projects/[slug]/[surfaceSlug]`. Shares chrome
 * (max width, Back link, OwnerToolbar, tab bar, title block) with the
 * project's main page so switching tabs feels like the same view with
 * a different body. The surface's own hero (if any) and body markdown
 * + image gallery sit below the tab bar.
 */
export default async function SurfaceDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; surfaceSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug, surfaceSlug } = await params;
  const { preview } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      surfaces: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { images: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!project) notFound();

  const surface = project.surfaces.find((s) => s.slug === surfaceSlug);
  if (!surface) notFound();

  const owner = await isAuthed();
  const previewing = preview === "1";
  const isProtected = !!project.passwordHash;
  const unlocked = isProtected ? await isProjectUnlocked(project.id) : true;
  if (isProtected && !owner && !unlocked) {
    return (
      <ProjectUnlock
        projectId={project.id}
        title={project.title}
        description={project.description}
      />
    );
  }

  // The tab bar talks in `id/slug/name` only — strip the heavier image
  // payload that we need for rendering the gallery below.
  const tabSurfaces = project.surfaces.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
  }));

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      {owner && <OwnerToolbar previewing={previewing} />}

      {/* Back returns to the project's main page — surfaces are nested
          views, not standalone routes. Preserves preview state. */}
      <FadeIn>
        <Link
          href={
            previewing
              ? `/projects/${project.slug}?preview=1`
              : `/projects/${project.slug}`
          }
          className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          <ArrowLeft size={11} weight="bold" aria-hidden />
          Back
        </Link>
      </FadeIn>

      {project.surfaces.length > 1 && (
        <div
          className="animate-fade-rise mt-6"
          style={{ ["--reveal-delay" as string]: "20ms" }}
        >
          <SurfaceTabBar
            mode="link"
            projectSlug={project.slug}
            activeSlug={surface.slug}
            surfaces={tabSurfaces}
            previewing={previewing}
          />
        </div>
      )}

      {/* Surface hero — fixed 16:10 frame with object-cover, matching
          the Overview hero treatment. Owners without a hero see an
          upload placeholder; visitors see nothing (no fallback to the
          project hero — that read as duplicating the Overview tab). */}
      <div
        className="animate-fade-rise group mt-6"
        style={{ ["--reveal-delay" as string]: "40ms" }}
      >
        <SurfaceHeroSlot
          projectId={project.id}
          surfaceId={surface.id}
          initialHeroImageUrl={surface.heroImageUrl}
          alt={`${project.title} — ${surface.name}`}
          owner={owner && !previewing}
        />
      </div>

      <header
        className="animate-fade-rise mt-8 flex flex-col gap-2"
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">
          {surface.name}
        </h1>
        {surface.description && (
          <p className="max-w-3xl text-[14px] text-muted">
            {surface.description}
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
          </div>
        )}
      </header>

      {/* Surface body — markdown content authored in the editor. */}
      {surface.body && (
        <article
          className="animate-fade-rise prose mt-10 max-w-3xl"
          style={{ ["--reveal-delay" as string]: "160ms" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {surface.body}
          </ReactMarkdown>
        </article>
      )}

      {/* Surface image gallery — single column at max-w-3xl so captions
          stay readable. Inline videos autoplay muted, matching the
          gallery card behavior. */}
      {surface.images.length > 0 && (
        <section className="mt-12 flex max-w-3xl flex-col gap-8">
          {surface.images.map((img, i) => (
            <figure
              key={img.id}
              className="animate-fade-rise"
              style={{
                ["--reveal-delay" as string]: `${240 + i * 70}ms`,
              }}
            >
              <div className="overflow-hidden rounded-[6px] border border-border-soft">
                {isVideoUrl(img.url) ? (
                  <video
                    src={img.url}
                    aria-label={img.caption ?? ""}
                    className="w-full"
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt={img.caption ?? ""}
                    className="w-full"
                  />
                )}
              </div>
              {img.caption && (
                <figcaption className="mt-2 text-[12px] text-muted">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </section>
      )}
    </main>
  );
}
