import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import matter from "gray-matter";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import { Avatar } from "@/components/avatar";
import { FadeIn } from "@/components/fade-in";
import { Gallery } from "@/components/gallery";
import { OwnerToolbar } from "@/components/owner-toolbar";
import { ViewEditorHeader } from "@/components/view-editor-header";
import { ViewGreeting } from "@/components/view-greeting";
import { ViewMarkdownEditorClient } from "@/components/view-markdown-editor-client";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

export const metadata: Metadata = {
  title: { absolute: "V.C. Billingsley" },
};

/**
 * Public render of a saved View — reads from the per-view tables
 * (ViewGroup + ViewProject) and the per-view markdown body
 * (View.aboutBody).
 *
 * Owner viewing this URL while logged in gets the full editor inline:
 * inline-editable view name + slug + greeting at the top, owner gallery
 * chrome (drag, resize, rename, upload), and an "Edit text" link that
 * routes to `?edit=1` for markdown source editing. Same shape the
 * homepage uses (`owner && !previewing` = editable in place).
 * Visitors and previewing-owners (`?preview=1`) see the same read-only
 * view a public link recipient sees.
 */
export default async function ViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; edit?: string }>;
}) {
  const { slug } = await params;
  const { preview, edit } = await searchParams;
  const previewing = preview === "1";

  const [view, settings, owner] = await Promise.all([
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
    isAuthed(),
  ]);
  if (!view) notFound();

  const editable = owner && !previewing;
  const editingText = editable && edit === "1";

  // Markdown is stored with optional frontmatter — parse the same way
  // readNomoDocument does, so layout/theme/font frontmatter still works.
  const parsed = view.aboutBody ? matter(view.aboutBody) : { content: "" };
  const aboutMarkdown = parsed.content ?? "";

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

  // Markdown source-editor mode — owner-only, swaps the whole page for
  // the same NomoEditor the main page uses at `/?edit=1`.
  if (editingText) {
    return (
      <main className="relative mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
        <Link
          href={`/v/${view.slug}`}
          className="mb-6 inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          ← Done editing text
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
      {owner && <OwnerToolbar />}

      {/* Owner editor chrome — name, slug, greeting, share/delete.
          Visitors and previewing-owners skip this entirely. */}
      {editable && (
        <ViewEditorHeader
          viewId={view.id}
          viewSlug={view.slug}
          viewName={view.name}
          greeting={view.greeting}
        />
      )}

      {settings?.avatarUrl && (
        <div
          className={
            "animate-fade-rise mb-10 " + (editable ? "mt-10" : "")
          }
          style={{ ["--reveal-delay" as string]: "40ms" }}
        >
          <Avatar initialUrl={settings.avatarUrl} editable={editable} />
        </div>
      )}

      <FadeIn>
        {/* Greeting renders for visitors only — owners edit it via the
            ViewEditorHeader's greeting input above. */}
        {!editable && view.greeting && <ViewGreeting text={view.greeting} />}

        {view.showAbout && aboutMarkdown && (
          <NomoMarkdown
            body={aboutMarkdown}
            context={{ avatarUrl: settings?.avatarUrl ?? null, caseStudies }}
          />
        )}

        {editable && (
          <div className="mt-4">
            <Link
              href={`/v/${view.slug}?edit=1`}
              className="inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/80 px-2 py-1 text-[11px] text-muted hover:border-border hover:text-fg"
            >
              Edit text
            </Link>
          </div>
        )}

        {view.showProjects && galleryGroups.length > 0 && (
          <section
            id="portfolio"
            className={view.showAbout ? "mt-16 scroll-mt-8" : "scroll-mt-8"}
          >
            <Gallery
              initial={galleryGroups}
              owner={owner}
              previewing={previewing}
              scope={{ kind: "view", viewId: view.id }}
              disableLinks
            />
          </section>
        )}
      </FadeIn>
    </main>
  );
}
