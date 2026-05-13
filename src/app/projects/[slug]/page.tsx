import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isAuthed } from "@/lib/auth";
import { isProjectUnlocked } from "@/lib/project-auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/project-form";
import { ProjectUnlock } from "@/components/project-unlock";

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
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!project) notFound();

  const owner = await isAuthed();
  const isProtected = !!project.passwordHash;
  const unlocked = isProtected ? await isProjectUnlocked(project.id) : true;
  const previewing = preview === "1";

  // Visitor + protected + not unlocked → password gate
  if (isProtected && !owner && !unlocked) {
    return (
      <ProjectUnlock
        projectId={project.id}
        title={project.title}
        description={project.description}
      />
    );
  }

  // Owner, not in preview → editable
  if (owner && !previewing) {
    const { passwordHash, ...rest } = project;
    const projectClient = { ...rest, isProtected: !!passwordHash };
    return (
      <main className="mx-auto max-w-3xl px-8 py-12">
        <div
          className="animate-fade-in flex items-center justify-between"
        >
          <Link
            href="/"
            className="text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            ← Back
          </Link>
          <Link
            href={`/projects/${project.slug}?preview=1`}
            className="rounded-[6px] border border-border bg-content px-3 py-1 text-[12px] text-muted hover:text-fg"
          >
            Preview ↗
          </Link>
        </div>
        <div
          className="animate-fade-rise mt-8"
          style={{ ["--reveal-delay" as string]: "80ms" }}
        >
          <ProjectForm project={projectClient} />
        </div>
      </main>
    );
  }

  // Read-only view (visitor or owner-previewing)
  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/"
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
        <h1 className="text-[22px] font-semibold tracking-[-0.018em] text-fg">{project.title}</h1>
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

      {project.heroImageUrl && (
        <div
          className="animate-fade-rise mt-8 overflow-hidden rounded-[6px] border border-border bg-content"
          style={{ ["--reveal-delay" as string]: "160ms" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={project.heroImageUrl} alt={project.title} className="w-full" />
        </div>
      )}

      {project.body && (
        <article
          className="animate-fade-rise prose mt-10 max-w-none"
          style={{ ["--reveal-delay" as string]: "240ms" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{project.body}</ReactMarkdown>
        </article>
      )}

      {project.images.length > 0 && (
        <section className="mt-12 flex flex-col gap-8">
          {project.images.map((img, i) => (
            <figure
              key={img.id}
              className="animate-fade-rise"
              style={{
                ["--reveal-delay" as string]: `${320 + i * 70}ms`,
              }}
            >
              <div className="overflow-hidden rounded-[6px] border border-border-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption ?? ""} className="w-full" />
              </div>
              {img.caption && (
                <figcaption className="mt-2 text-[12px] text-muted">{img.caption}</figcaption>
              )}
            </figure>
          ))}
        </section>
      )}
    </main>
  );
}
