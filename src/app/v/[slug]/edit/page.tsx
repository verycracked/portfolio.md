import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import matter from "gray-matter";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import { Avatar } from "@/components/avatar";
import { FadeIn } from "@/components/fade-in";
import { Gallery } from "@/components/gallery";
import { OwnerToolbar } from "@/components/owner-toolbar";
import { ViewEditorHeader } from "@/components/view-editor-header";
import { ViewMarkdownEditorClient } from "@/components/view-markdown-editor-client";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

/**
 * Owner-only editor for a view at `/v/[slug]/edit`. Gated behind
 * `isAuthed()` — unauthenticated visitors get bounced to /lock.
 *
 * Renders the same shape as `/` with full owner chrome (drag, resize,
 * rename, upload). `?edit=1` on THIS route opens the markdown split-pane
 * editor for the view's about body.
 *
 * The public share URL stays at `/v/[slug]` (always read-only).
 */
export default async function ViewEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const owner = await isAuthed();
  if (!owner) redirect("/lock");

  const { slug } = await params;
  const { edit } = await searchParams;
  const editingText = edit === "1";

  const [view, settings] = await Promise.all([
    prisma.view.findUnique({
      where: { slug },
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

  const parsed = view.aboutBody ? matter(view.aboutBody) : { content: "", data: {} };
  const markdownBody = parsed.content ?? "";

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
      isProtected: false,
      childCount: 0,
      colSpan: p.colSpan,
      rowSpan: p.rowSpan,
    })),
  }));

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

  // Markdown source-editor mode.
  if (editingText) {
    return (
      <main className="relative mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
        <Link
          href={`/v/${view.slug}/edit`}
          className="mb-6 inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          <ArrowLeft size={11} weight="bold" aria-hidden />
          Done editing text
        </Link>
        <ViewMarkdownEditorClient
          viewId={view.id}
          initialRaw={view.aboutBody}
          avatarUrl={settings?.avatarUrl ?? null}
          caseStudies={caseStudies}
        />
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      <OwnerToolbar />

      <ViewEditorHeader
        viewId={view.id}
        viewSlug={view.slug}
        viewName={view.name}
        greeting={view.greeting}
      />

      <div
        className="animate-fade-rise mb-10 mt-10"
        style={{ ["--reveal-delay" as string]: "40ms" }}
      >
        <Avatar initialUrl={settings?.avatarUrl ?? null} editable />
      </div>

      <FadeIn>
        <NomoMarkdown
          body={markdownBody}
          context={{ avatarUrl: settings?.avatarUrl ?? null, caseStudies }}
        />
        <div className="mt-4">
          <Link
            href={`/v/${view.slug}/edit?edit=1`}
            className="inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/80 px-2 py-1 text-[11px] text-muted hover:border-border hover:text-fg"
          >
            Edit text
          </Link>
        </div>

        <section id="portfolio" className="mt-16 scroll-mt-8">
          <Gallery
            initial={galleryGroups}
            owner
            scope={{ kind: "view", viewId: view.id }}
            disableLinks
          />
        </section>
      </FadeIn>
    </main>
  );
}
