import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/project-form";
import { ProjectStructureControl } from "@/components/project-structure-control";

export default async function EditProject({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOwner(`/edit/${id}`);
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      surfaces: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { images: { orderBy: { order: "asc" } } },
      },
      _count: { select: { children: true } },
    },
  });
  if (!project) notFound();

  // Build the list of potential parent candidates: every other project,
  // minus this one and any descendant (to avoid creating a cycle in the
  // parent/children tree). We walk the descendant set with a single
  // findMany + BFS instead of a recursive CTE for simplicity.
  const allProjects = await prisma.project.findMany({
    select: { id: true, title: true, slug: true, parentId: true },
  });
  const descendantSet = new Set<string>([project.id]);
  let frontier = [project.id];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const row of allProjects) {
      if (row.parentId && frontier.includes(row.parentId)) {
        if (!descendantSet.has(row.id)) {
          descendantSet.add(row.id);
          next.push(row.id);
        }
      }
    }
    frontier = next;
  }
  const parentOptions = allProjects
    .filter((p) => !descendantSet.has(p.id))
    .map(({ parentId: _parentId, ...rest }) => rest)
    .sort((a, b) => a.title.localeCompare(b.title));

  // strip hash before passing to client
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
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/"
          className="text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          ← Home
        </Link>
        <Link
          href={`/projects/${project.slug}`}
          target="_blank"
          className="text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          View ↗
        </Link>
      </header>
      <ProjectForm project={projectClient} />
      <div className="mt-10">
        <ProjectStructureControl
          projectId={project.id}
          initialIsOpenable={project.isOpenable}
          initialParentId={project.parentId}
          hasChildren={project._count.children > 0}
          parentOptions={parentOptions}
        />
      </div>
    </main>
  );
}
