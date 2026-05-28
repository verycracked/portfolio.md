import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readNomoDocument } from "@/lib/nomo-content";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import { FadeIn } from "@/components/fade-in";
import { Gallery } from "@/components/gallery";
import { OwnerToolbar } from "@/components/owner-toolbar";
import { ViewGreeting } from "@/components/view-greeting";
import { parseIdList } from "@/lib/view-helpers";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

export const metadata: Metadata = {
  title: { absolute: "V.C. Billingsley" },
};

/**
 * Public render of a saved View. Same overall shape as `/` but the
 * sections are filtered/toggled per the View row:
 *
 *   • `showAbout`     → render the markdown intro + avatar (or skip it)
 *   • `showProjects`  → render the gallery (or skip it)
 *   • `projectIds[]`  → only show these projects in the gallery (empty
 *                       array means "no filter — show all")
 *   • `groupIds[]`    → only render these groups in the gallery
 *   • `greeting`      → optional banner at the top, "Hi Sarah, here's…"
 *
 * The owner gets the regular OwnerToolbar so they can hop to /views or
 * back to `/`. Visitors see no chrome other than what the View opted in.
 */
export default async function ViewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const view = await prisma.view.findUnique({ where: { slug } });
  if (!view) notFound();

  const projectWhitelist = parseIdList(view.projectIds);
  const groupWhitelist = parseIdList(view.groupIds);

  const [doc, settings, owner, groupRows] = await Promise.all([
    // Markdown body is only fetched when the view actually shows the
    // about section — small win on the projects-only case.
    view.showAbout
      ? readNomoDocument("human")
      : Promise.resolve({ raw: "", body: "" }),
    view.showAbout
      ? prisma.settings.findUnique({
          where: { id: "main" },
          select: { avatarUrl: true },
        })
      : Promise.resolve(null),
    isAuthed(),
    view.showProjects
      ? prisma.group.findMany({
          where:
            groupWhitelist.length > 0
              ? { id: { in: groupWhitelist } }
              : undefined,
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: {
            projects: {
              where: {
                parentId: null,
                ...(projectWhitelist.length > 0
                  ? { id: { in: projectWhitelist } }
                  : {}),
              },
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                slug: true,
                title: true,
                description: true,
                heroImageUrl: true,
                posterUrl: true,
                hasAudio: true,
                isOpenable: true,
                passwordHash: true,
                colSpan: true,
                rowSpan: true,
                _count: { select: { children: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  // Drop empty groups so a project whitelist that excluded everything in
  // a group doesn't leave a lone section header behind.
  const populatedGroups = groupRows.filter((g) => g.projects.length > 0);

  const allProjects = populatedGroups.flatMap((g) => g.projects);

  const caseStudies = new Map<string, ProjectSummary>(
    allProjects.map((p) => [
      p.slug,
      {
        slug: p.slug,
        title: p.title,
        description: p.description,
        heroImageUrl: p.heroImageUrl,
        firstSurfaceSlug: "overview",
        isProtected: !!p.passwordHash,
      },
    ])
  );

  const galleryGroups: GalleryGroup[] = populatedGroups.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    order: g.order,
    projects: g.projects.map(({ passwordHash, _count, ...rest }) => ({
      ...rest,
      isProtected: !!passwordHash,
      childCount: _count.children,
    })),
  }));

  return (
    <FadeIn>
      {owner && <OwnerToolbar />}

      {view.greeting && <ViewGreeting text={view.greeting} />}

      {view.showAbout && (
        <NomoMarkdown
          body={doc.body}
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
            owner={false /* read-only on a shared view */}
            previewing
          />
        </section>
      )}
    </FadeIn>
  );
}
