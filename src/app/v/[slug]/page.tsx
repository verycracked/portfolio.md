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
import { ViewGreeting } from "@/components/view-greeting";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

export const metadata: Metadata = {
  title: { absolute: "V.C. Billingsley" },
};

/**
 * Public share URL for a View — always read-only. This is what
 * prospects / recipients see. Owner gets a small "Edit" link at the
 * top-right that routes to /v/[slug]/edit; visitors don't see it.
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
              include: {
                sourceProject: { select: { slug: true } },
              },
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

  const parsed = view.aboutBody ? matter(view.aboutBody) : { content: "" };
  const aboutMarkdown = parsed.content ?? "";

  const galleryGroups: GalleryGroup[] = view.groups.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    linkUrl: g.linkUrl ?? "",
    order: g.order,
    projects: g.projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      heroImageUrl: p.heroImageUrl,
      posterUrl: p.posterUrl,
      sourceUrl: p.sourceUrl ?? null,
      links: Array.isArray(p.links) ? p.links as { label: string; url: string }[] : [],
      hasAudio: p.hasAudio,
      isOpenable: p.isOpenable,
      isProtected: false,
      childCount: 0,
      colSpan: p.colSpan,
      rowSpan: p.rowSpan,
      canonicalSlug: p.sourceProject?.slug ?? null,
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
    <main className="relative mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      {/* Owner sees a small Edit link top-right so they can hop into
          the editor without changing the URL they share. */}
      {owner && (
        <div className="absolute right-5 top-5 z-20 md:right-[3.75rem] md:top-8">
          <Link
            href={`/v/${view.slug}/edit`}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-border-soft bg-content/80 px-2.5 py-1 text-[12px] text-muted backdrop-blur transition-colors hover:border-border hover:text-fg"
          >
            Edit view
          </Link>
        </div>
      )}

      {settings?.avatarUrl && (
        <div
          className="animate-fade-rise mb-10"
          style={{ ["--reveal-delay" as string]: "40ms" }}
        >
          <Avatar initialUrl={settings.avatarUrl} editable={false} />
        </div>
      )}

      <FadeIn>
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
    </main>
  );
}
