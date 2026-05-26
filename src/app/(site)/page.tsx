import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readNomoDocument } from "@/lib/nomo-content";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import { NomoEditor } from "@/components/nomo-editor";
import { FadeIn } from "@/components/fade-in";
import { Gallery } from "@/components/gallery";
import { HomeDropzone } from "@/components/home-dropzone";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

export const metadata: Metadata = {
  title: { absolute: "V.C. Billingsley" },
};

// Single unified page: markdown body (about content) on top, grouped project
// gallery below. Owner can edit the markdown via `?edit=1`.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; edit?: string }>;
}) {
  const [{ preview, edit }, doc, settings, owner, groupRows] = await Promise.all([
    searchParams,
    readNomoDocument("human"),
    prisma.settings.findUnique({
      where: { id: "main" },
      select: { avatarUrl: true },
    }),
    isAuthed(),
    prisma.group.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        projects: {
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
        },
      },
    }),
  ]);
  const editing = owner && edit === "1";
  const previewing = preview === "1";

  const allProjects = groupRows.flatMap((g) => g.projects);

  // Case-study map (slug → summary) for the markdown renderer's hover
  // tooltips on pills whose slug matches a project. Built from the flat
  // list across every section.
  const caseStudies = new Map<string, ProjectSummary>(
    allProjects.map((p) => [
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

  // Shape into the GalleryGroup type the client expects. Each tile prefers
  // the active surface's hero, falling back to the legacy project-level one.
  const galleryGroups: GalleryGroup[] = groupRows.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    order: g.order,
    projects: g.projects.map(
      ({ passwordHash, surfaces, heroImageUrl, ...rest }) => ({
        ...rest,
        heroImageUrl: surfaces[0]?.heroImageUrl ?? heroImageUrl,
        isProtected: !!passwordHash,
      })
    ),
  }));

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
      {owner && !previewing && <HomeDropzone />}
      <NomoMarkdown
        body={doc.body}
        context={{ avatarUrl: settings?.avatarUrl ?? null, caseStudies }}
      />
      <section id="portfolio" className="mt-16 scroll-mt-8">
        <Gallery
          initial={galleryGroups}
          owner={owner}
          previewing={previewing}
        />
      </section>
    </FadeIn>
  );
}
