import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import matter from "gray-matter";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import { NomoEditor } from "@/components/nomo-editor";
import { Avatar } from "@/components/avatar";
import { FadeIn } from "@/components/fade-in";
import { Gallery } from "@/components/gallery";
import { ViewEditorHeader } from "@/components/view-editor-header";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

/**
 * Per-view editor. Renders the exact same shape as `/` — avatar +
 * markdown intro + gallery with full owner chrome — but every write
 * is view-scoped. The markdown body is read-only by default; toggling
 * `?edit=1` opens the same NomoEditor the homepage uses for markdown
 * edits. Two modes, identical layout to the main page.
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
  const editing = edit === "1";

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

  // Parse the view's markdown body — same parser the main page uses so
  // frontmatter (align/theme/font/fontsize) is respected in the rendered
  // preview, just like /.
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

  // Edit mode — same NomoEditor the main page renders at /?edit=1.
  // Whole page collapses to the editor; gallery is hidden during text
  // edits to match the main page's behavior.
  if (editing) {
    return (
      <main className="relative mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
        <Link
          href={`/views/${view.slug}`}
          className="mb-6 inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          <ArrowLeft size={11} weight="bold" aria-hidden />
          Done editing text
        </Link>
        <ViewMarkdownEditor
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
      <ViewEditorHeader
        viewId={view.id}
        viewSlug={view.slug}
        viewName={view.name}
        greeting={view.greeting}
      />

      {/* Avatar — same Avatar component the SiteShell uses on `/`. */}
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
        {/* Inline edit-text affordance — owner-only, matches the
            UX of the main page where ?edit=1 swaps NomoMarkdown for
            NomoEditor. */}
        <div className="mt-4">
          <Link
            href={`/views/${view.slug}?edit=1`}
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

/**
 * Tiny client wrapper that lets the markdown editor save into the
 * per-view About column rather than the canonical Page table. Lives
 * here so the server page can hand it the raw + avatar + case studies
 * without a separate component file.
 */
import { ViewMarkdownEditorClient } from "@/components/view-markdown-editor-client";
function ViewMarkdownEditor(props: {
  viewId: string;
  initialRaw: string;
  avatarUrl: string | null;
  caseStudies: Map<string, ProjectSummary>;
}) {
  return <ViewMarkdownEditorClient {...props} />;
}
