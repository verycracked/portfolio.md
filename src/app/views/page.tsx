import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseIdList } from "@/lib/view-helpers";
import { ViewsManager } from "@/components/views-manager";

/**
 * Owner-only management surface for shareable Views. Lists every saved
 * view, lets the owner add new ones, edit toggles + the project picker,
 * copy share links, and delete views they don't need anymore.
 */
export default async function ViewsPage() {
  const owner = await isAuthed();
  if (!owner) redirect("/lock");

  const [viewRows, groupRows] = await Promise.all([
    prisma.view.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.group.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        projects: {
          where: { parentId: null },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, slug: true },
        },
      },
    }),
  ]);

  // Normalize the Json columns to string arrays so the client component
  // can treat them as plain typed data.
  const views = viewRows.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    greeting: v.greeting,
    showAbout: v.showAbout,
    showProjects: v.showProjects,
    projectIds: parseIdList(v.projectIds),
    groupIds: parseIdList(v.groupIds),
    createdAt: v.createdAt.toISOString(),
  }));

  const groups = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    projects: g.projects.map((p) => ({
      id: p.id,
      title: p.title || "Untitled",
      slug: p.slug,
    })),
  }));

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:px-[3.75rem]">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
      >
        <ArrowLeft size={11} weight="bold" aria-hidden />
        Back
      </Link>

      <header className="mt-8 flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">
          Views
        </h1>
        <p className="max-w-2xl text-[13px] text-muted">
          Create different presentations of your portfolio and share the
          right one with the right person. Each view has a unique URL —
          recipients see only what you toggled on.
        </p>
      </header>

      <div className="mt-10">
        <ViewsManager initialViews={views} groups={groups} />
      </div>
    </main>
  );
}
