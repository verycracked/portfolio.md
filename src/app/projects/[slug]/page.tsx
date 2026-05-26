import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { isProjectUnlocked } from "@/lib/project-auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/project-form";
import { ProjectUnlock } from "@/components/project-unlock";

// Owner lands here to edit; visitors are redirected to the first surface URL
// so the public site always shows /projects/[slug]/[surfaceSlug].
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
      surfaces: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { images: { orderBy: { order: "asc" } } },
      },
    },
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

  // Visitor (or owner-previewing): send them to the first surface's URL.
  if (!owner || previewing) {
    const first = project.surfaces[0];
    if (!first) notFound();
    const url = `/projects/${project.slug}/${first.slug}${
      previewing ? "?preview=1" : ""
    }`;
    redirect(url);
  }

  // Owner editing in place.
  const { passwordHash, ...rest } = project;
  const projectClient = {
    ...rest,
    isProtected: !!passwordHash,
    surfaces: project.surfaces.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      body: s.body,
      heroImageUrl: s.heroImageUrl,
      order: s.order,
      images: s.images.map((i) => ({
        id: i.id,
        url: i.url,
        caption: i.caption,
      })),
    })),
  };

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="animate-fade-in flex items-center justify-between">
        <Link
          href="/portfolio"
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
