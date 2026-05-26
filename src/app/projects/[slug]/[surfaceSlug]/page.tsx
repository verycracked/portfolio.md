import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isAuthed } from "@/lib/auth";
import { isProjectUnlocked } from "@/lib/project-auth";
import { prisma } from "@/lib/prisma";
import { ProjectUnlock } from "@/components/project-unlock";
import { SurfaceTabBar } from "@/components/surface-tab-bar";
import { isVideoUrl } from "@/lib/media";

export default async function SurfaceDetail({
  params,
}: {
  params: Promise<{ slug: string; surfaceSlug: string }>;
}) {
  const { slug, surfaceSlug } = await params;

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

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/portfolio.md"
          className="text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          ← Back
        </Link>
        {owner && (
          <Link
            href={`/projects/${project.slug}`}
            className="rounded-[6px] bg-fg px-3 py-1 text-[12px] font-medium text-content"
          >
            Edit
          </Link>
        )}
      </div>

      <header
        className="animate-fade-rise mt-8"
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <h1 className="text-[22px] font-semibold tracking-[-0.018em] text-fg">
          {project.title}
        </h1>
        {project.description && (
          <p className="mt-2 text-[13px] text-muted">{project.description}</p>
        )}
        {project.sourceUrl && (
          <a
            href={project.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            {new URL(project.sourceUrl).hostname} ↗
          </a>
        )}
      </header>

      {project.surfaces.length > 1 && (
        <div
          className="animate-fade-rise mt-8"
          style={{ ["--reveal-delay" as string]: "120ms" }}
        >
          <SurfaceTabBar
            mode="link"
            projectSlug={project.slug}
            activeSlug={surface.slug}
            surfaces={project.surfaces.map((s) => ({
              id: s.id,
              slug: s.slug,
              name: s.name,
            }))}
          />
        </div>
      )}

      {surface.heroImageUrl && (
        <div
          className="animate-fade-rise mt-8 overflow-hidden rounded-[6px] border border-border bg-content"
          style={{ ["--reveal-delay" as string]: "160ms" }}
        >
          {isVideoUrl(surface.heroImageUrl) ? (
            <video
              src={surface.heroImageUrl}
              aria-label={`${project.title} — ${surface.name}`}
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
              src={surface.heroImageUrl}
              alt={`${project.title} — ${surface.name}`}
              className="w-full"
            />
          )}
        </div>
      )}

      {surface.body && (
        <article
          className="animate-fade-rise prose mt-10 max-w-none"
          style={{ ["--reveal-delay" as string]: "240ms" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {surface.body}
          </ReactMarkdown>
        </article>
      )}

      {surface.images.length > 0 && (
        <section className="mt-12 flex flex-col gap-8">
          {surface.images.map((img, i) => (
            <figure
              key={img.id}
              className="animate-fade-rise"
              style={{
                ["--reveal-delay" as string]: `${320 + i * 70}ms`,
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
