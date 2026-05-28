import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ViewEditor } from "@/components/view-editor";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

/**
 * Per-view editor — renders the same shape as `/` (avatar + markdown
 * intro + gallery sections + tiles), but every read and write is
 * scoped to this view's own tables. Owner can drag, resize, rename,
 * upload, etc., and none of it bleeds into the main page or other views.
 */
export default async function ViewEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const owner = await isAuthed();
  if (!owner) redirect("/lock");
  const { id } = await params;

  const [view, settings] = await Promise.all([
    prisma.view.findUnique({
      where: { id },
      include: {
        groups: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: {
            projects: {
              where: { parentId: null },
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    }),
    prisma.settings.findUnique({
      where: { id: "main" },
      select: { avatarUrl: true },
    }),
  ]);
  if (!view) notFound();

  // Reshape ViewGroup + ViewProject rows into the GalleryGroup shape the
  // client gallery components already speak. Childcount = 0 because the
  // view editor doesn't surface sub-projects (those live on the
  // canonical detail page for tiles seeded from a Project).
  const galleryGroups: GalleryGroup[] = view.groups.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    order: g.order,
    projects: g.projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      heroImageUrl: p.heroImageUrl,
      posterUrl: p.posterUrl,
      hasAudio: p.hasAudio,
      isOpenable: p.isOpenable,
      // ViewProject doesn't store a password hash; everything in a view
      // is owner-curated and the public render bypasses the lock gate.
      isProtected: false,
      childCount: 0,
      colSpan: p.colSpan,
      rowSpan: p.rowSpan,
    })),
  }));

  // Case-study map for the markdown renderer's pill hover previews —
  // surface a snapshot of every view-scoped project so links inside
  // the per-view markdown find their hover preview.
  const allProjects = galleryGroups.flatMap((g) => g.projects);
  const caseStudies = new Map<string, ProjectSummary>(
    allProjects.map((p) => [
      p.slug,
      {
        slug: p.slug,
        title: p.title,
        description: p.description,
        heroImageUrl: p.heroImageUrl,
        firstSurfaceSlug: "overview",
        isProtected: false,
      },
    ])
  );

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      <Link
        href="/views"
        className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
      >
        <ArrowLeft size={11} weight="bold" aria-hidden />
        Back to views
      </Link>

      <ViewEditor
        viewId={view.id}
        viewSlug={view.slug}
        viewName={view.name}
        greeting={view.greeting}
        aboutBody={view.aboutBody}
        avatarUrl={settings?.avatarUrl ?? null}
        groups={galleryGroups}
        caseStudies={caseStudies}
      />
    </main>
  );
}
