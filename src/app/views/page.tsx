import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ViewsList } from "@/components/views-list";

/**
 * Owner-only list of every saved view. Each row links to /views/[id]
 * for the visual per-view editor. Inline form removed — view editing
 * happens in the dedicated editor route.
 */
export default async function ViewsPage() {
  const owner = await isAuthed();
  if (!owner) redirect("/lock");

  const viewRows = await prisma.view.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      greeting: true,
      _count: {
        select: {
          groups: true,
          projects: true,
        },
      },
    },
  });

  const views = viewRows.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    greeting: v.greeting,
    groupCount: v._count.groups,
    projectCount: v._count.projects,
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
          Each view is a fresh copy of your portfolio that you can edit
          independently. Share the URL of the view that suits the
          audience — recipients see whatever you curated there.
        </p>
      </header>

      <div className="mt-10">
        <ViewsList initialViews={views} />
      </div>
    </main>
  );
}
