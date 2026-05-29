import "server-only";
import { prisma } from "@/lib/prisma";
import { readNomoDocument } from "@/lib/nomo-content";

/**
 * Seed a freshly-created View with a snapshot of the main `/` page so the
 * owner starts from a working baseline that they can mutate independently
 * (drag, resize, rename, upload — all isolated to this view).
 *
 *   1. View.aboutBody  ← raw of `human.md` (the markdown intro)
 *   2. For each Group → one ViewGroup (same slug, name, order)
 *   3. For each top-level Project → one ViewProject, scoped to the matching
 *      ViewGroup, carrying every visible field plus a `sourceProjectId`
 *      pointing back at the canonical Project (so view tiles can still
 *      deep-link to /projects/[slug]).
 *
 * Sub-projects (Project.parentId != null) are NOT seeded — they're
 * surfaced via the canonical detail page that the view tile links to.
 * Keeps the snapshot shallow + fast.
 */
export async function seedViewFromMain(viewId: string): Promise<void> {
  const [doc, groupRows] = await Promise.all([
    readNomoDocument("human").catch(() => ({ raw: "", body: "" })),
    prisma.group.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        projects: {
          where: { parentId: null },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
  ]);

  await prisma.view.update({
    where: { id: viewId },
    data: { aboutBody: doc.raw },
  });

  // Create one ViewGroup per Group, sequentially so order numbers stay
  // stable and we can attach projects to the right newly-created id.
  for (const group of groupRows) {
    const viewGroup = await prisma.viewGroup.create({
      data: {
        viewId,
        slug: group.slug,
        name: group.name,
        linkUrl: group.linkUrl ?? "",
        order: group.order,
      },
    });

    if (group.projects.length === 0) continue;

    // Batch-insert all the tiles for this group.
    await prisma.viewProject.createMany({
      data: group.projects.map((p) => ({
        viewId,
        viewGroupId: viewGroup.id,
        sourceProjectId: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        sourceUrl: p.sourceUrl,
        links: Array.isArray(p.links) ? p.links : [],
        heroImageUrl: p.heroImageUrl,
        posterUrl: p.posterUrl,
        heroOffsetY: p.heroOffsetY,
        hasAudio: p.hasAudio,
        isOpenable: p.isOpenable,
        colSpan: p.colSpan,
        rowSpan: p.rowSpan,
        order: p.order,
      })),
    });
  }
}
