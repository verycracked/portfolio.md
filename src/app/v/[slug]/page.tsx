import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import matter from "gray-matter";
import { FadeIn } from "@/components/fade-in";
import { Gallery } from "@/components/gallery";
import { OwnerToolbar } from "@/components/owner-toolbar";
import { ViewGreeting } from "@/components/view-greeting";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

export const metadata: Metadata = {
  title: { absolute: "V.C. Billingsley" },
};

/**
 * Public render of a saved View — reads from the per-view tables
 * (ViewGroup + ViewProject) and the per-view markdown body
 * (View.aboutBody). Each view is independent of `/` and every other
 * view, so what visitors see is exactly what the owner curated.
 */
export default async function ViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  return (
    <FadeIn>
      {owner && <OwnerToolbar />}

      {view.greeting && <ViewGreeting text={view.greeting} />}

      {view.showAbout && aboutMarkdown && (
        <NomoMarkdown
          body={aboutMarkdown}
          context={{ avatarUrl: settings?.avatarUrl ?? null, caseStudies }}
        />
      )}

      {view.showProjects && galleryGroups.length > 0 && (
        <section
          id="portfolio"
          className={view.showAbout ? "mt-16 scroll-mt-8" : "scroll-mt-8"}
        >
          <Gallery
            initial={galleryGroups}
            owner={false}
            previewing
            disableLinks
          />
        </section>
      )}
    </FadeIn>
  );
}
