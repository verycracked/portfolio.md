import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/project-form";

export default async function EditProject({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireOwner(`/edit/${id}`);
  const project = await prisma.project.findUnique({
    where: { id },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!project) notFound();

  // strip hash before passing to client
  const { passwordHash, ...rest } = project;
  const projectClient = { ...rest, isProtected: !!passwordHash };

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/edit"
          className="text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          ← All projects
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
    </main>
  );
}
