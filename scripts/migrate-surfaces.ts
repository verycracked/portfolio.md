/**
 * Idempotent backfill: every existing Project gets an "Overview" surface
 * whose body and heroImageUrl come from the project itself, and every
 * existing ProjectImage with no surfaceId is reassigned to that surface.
 *
 * Safe to run multiple times. After running, the schema can switch
 * ProjectImage.surfaceId from nullable to required (no --accept-data-loss).
 *
 * Usage:
 *   pnpm tsx scripts/migrate-surfaces.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SLUG = "overview";
const DEFAULT_NAME = "Overview";

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      slug: true,
      body: true,
      heroImageUrl: true,
    },
  });
  console.log(`[migrate-surfaces] found ${projects.length} project(s)`);

  let surfacesCreated = 0;
  let imagesReassigned = 0;

  for (const project of projects) {
    // Upsert the default surface for this project.
    const surface = await prisma.surface.upsert({
      where: {
        projectId_slug: { projectId: project.id, slug: DEFAULT_SLUG },
      },
      update: {},
      create: {
        projectId: project.id,
        slug: DEFAULT_SLUG,
        name: DEFAULT_NAME,
        body: project.body,
        heroImageUrl: project.heroImageUrl,
        order: 0,
      },
    });

    // Re-create-then-found: count only when the surface was newly inserted.
    if (
      surface.body === project.body &&
      surface.heroImageUrl === project.heroImageUrl
    ) {
      surfacesCreated += 1;
    }

    // Reassign any orphaned images on this project to the Overview surface.
    // ProjectImage.surfaceId is required at the model level now, but during
    // the migration window it was nullable, so we tunnel through `any` for
    // the filter. Safe to keep — the where-clause is a no-op once all rows
    // have a surfaceId set.
    const result = await prisma.projectImage.updateMany({
      where: { projectId: project.id, surfaceId: null } as never,
      data: { surfaceId: surface.id },
    });
    imagesReassigned += result.count;

    console.log(
      `  ${project.slug}: surface=${surface.id} images_reassigned=${result.count}`
    );
  }

  console.log(
    `[migrate-surfaces] done. surfaces upserted=${projects.length}, images reassigned=${imagesReassigned}`
  );
  void surfacesCreated;
}

main()
  .catch((err) => {
    console.error("[migrate-surfaces] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
