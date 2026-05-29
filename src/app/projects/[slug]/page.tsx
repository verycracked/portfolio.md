import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChildGallery } from "@/components/child-gallery";
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

/** Show a clean hostname for the source-url link. */
function sourceUrlLabel(raw: string): string {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, "");
  } catch {
    return raw.trim();
  }
}

/**
 * Overview view at `/projects/[slug]`. Shared chrome (Back link, owner
 * toolbar, surface tab bar, hero) lives in the layout — this page only
 * renders the body content that the user sees BELOW the hero, which is
 * what slides between tabs.
 *
 * The Overview view is backed by the project's `overview` Surface row:
 * the description, markdown body, and inline image gallery the user
 * edits in the editor's Overview tab live there. We render them in
 * the same shape the surface page uses so switching tabs feels
 * homogeneous.
 *
 * Password protection + media-tile redirects are handled here too,
 * since the layout doesn't know about searchParams or children counts.
 */
export default async function ProjectOverview({
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
      // Pull the Overview surface so its description/body/images can
      // render on the public page. Falls back to project.description
      // when the surface description is empty (older projects that
      // never touched the surface description field).
      surfaces: {
        where: { slug: "overview" },
        include: { images: { orderBy: { order: "asc" } } },
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
          sourceUrl: true,
            links: true,
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

  const childGalleryData: GalleryProject[] = project.children.map(
    ({ passwordHash, _count, links, ...rest }) => ({
      ...rest,
      links: Array.isArray(links) ? links as { label: string; url: string }[] : [],
      isProtected: !!passwordHash,
      childCount: _count.children,
    })
  );

  const overview = project.surfaces[0];
  const description =
    (overview?.description && overview.description.trim()) ||
    project.description;
  const body = overview?.body ?? "";
  const images = overview?.images ?? [];

  return (
    <>
      {/* Title + description + optional source link */}
      <header
        className="animate-fade-rise mt-8 flex flex-col gap-2"
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">
          {project.title || "Untitled media tile"}
        </h1>
        {description && (
          <p className="max-w-3xl text-[14px] text-muted">{description}</p>
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

      {/* Long-form markdown body authored against the Overview surface. */}
      {body && (
        <article
          className="animate-fade-rise prose mt-10 max-w-3xl"
          style={{ ["--reveal-delay" as string]: "120ms" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </article>
      )}

      {/* Inline image / video gallery for the Overview surface. */}
      {images.length > 0 && (
        <section className="mt-12 flex max-w-3xl flex-col gap-8">
          {images.map((img, i) => (
            <figure
              key={img.id}
              className="animate-fade-rise"
              style={{
                ["--reveal-delay" as string]: `${160 + i * 70}ms`,
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

      {/* Sub-projects grid — single bento, identical chrome to the
          homepage gallery. Hidden for visitors when empty; owner mode
          always renders so the "+ Upload" tile is reachable. */}
      {(owner && !previewing) || childGalleryData.length > 0 ? (
        <section
          className="animate-fade-rise mt-16 scroll-mt-8"
          style={{ ["--reveal-delay" as string]: "200ms" }}
        >
          <ChildGallery
            parentId={project.id}
            initial={childGalleryData}
            owner={owner}
            previewing={previewing}
          />
        </section>
      ) : null}
    </>
  );
}
