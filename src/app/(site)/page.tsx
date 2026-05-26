import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readNomoDocument } from "@/lib/nomo-content";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import { NomoEditor } from "@/components/nomo-editor";
import { FadeIn } from "@/components/fade-in";
import { Gallery } from "@/components/gallery";
import type { ProjectSummary } from "@/lib/case-study";

export const metadata: Metadata = {
  title: { absolute: "vc billingsley — design engineer" },
};

// Single unified page: markdown body (about content) on top, project
// gallery below. Owner can edit the markdown via `?edit=1`.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; edit?: string }>;
}) {
  const [{ preview, edit }, doc, settings, owner, projectRows] = await Promise.all([
    searchParams,
    readNomoDocument("human"),
    prisma.settings.findUnique({
      where: { id: "main" },
      select: { avatarUrl: true },
    }),
    isAuthed(),
    prisma.project.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        heroImageUrl: true,
        passwordHash: true,
        colSpan: true,
        rowSpan: true,
        surfaces: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          take: 1,
          select: { slug: true, heroImageUrl: true },
        },
      },
    }),
  ]);
  const editing = owner && edit === "1";
  const previewing = preview === "1";

  // Case-study map (slug → summary) for the markdown renderer's hover
  // tooltips on pills whose slug matches a project.
  const caseStudies = new Map<string, ProjectSummary>(
    projectRows.map((p) => [
      p.slug,
      {
        slug: p.slug,
        title: p.title,
        description: p.description,
        heroImageUrl: p.surfaces[0]?.heroImageUrl ?? null,
        firstSurfaceSlug: p.surfaces[0]?.slug ?? "overview",
        isProtected: !!p.passwordHash,
      },
    ])
  );

  // Gallery cards prefer the active surface's hero, fall back to the
  // legacy project-level hero.
  const galleryProjects = projectRows.map(
    ({ passwordHash, surfaces, heroImageUrl, ...rest }) => ({
      ...rest,
      heroImageUrl: surfaces[0]?.heroImageUrl ?? heroImageUrl,
      isProtected: !!passwordHash,
    })
  );

  if (editing) {
    return (
      <NomoEditor
        slug="human"
        initialRaw={doc.raw}
        avatarUrl={settings?.avatarUrl ?? null}
        caseStudies={caseStudies}
      />
    );
  }

  return (
    <FadeIn>
      <NomoMarkdown
        body={doc.body}
        context={{ avatarUrl: settings?.avatarUrl ?? null, caseStudies }}
      />
      <section id="portfolio" className="mt-16 scroll-mt-8">
        <Gallery
          initial={galleryProjects}
          owner={owner}
          previewing={previewing}
        />
      </section>
    </FadeIn>
  );
}
