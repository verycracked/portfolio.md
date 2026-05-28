import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isVideoUrl } from "@/lib/media";

/** Prepend `https://` if the owner saved a bare hostname. */
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

/**
 * Surface detail body. Shared chrome (Back, owner toolbar, tab bar,
 * hero) lives in the parent layout — this page only renders the
 * sliding body content that varies per surface: title, description,
 * markdown body, and the inline image gallery.
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
  const previewing = preview === "1";

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      sourceUrl: true,
      surfaces: {
        where: { slug: surfaceSlug },
        include: { images: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!project) notFound();

  const surface = project.surfaces[0];
  if (!surface) notFound();

  const owner = await isAuthed();

  return (
    <>
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
    </>
  );
}
