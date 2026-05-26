/**
 * Dev-only helper: pick the oldest `untitled-project-…` project and rename it
 * to a slug + title pulled from a pill label in content/human.md. Lets us see
 * the case-study wiring fire end-to-end without touching the editor UI.
 *
 * Usage:
 *   pnpm exec tsx scripts/seed-case-study.ts <slug> <"Title">
 *   pnpm exec tsx scripts/seed-case-study.ts starbase "Starbase"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, , slug, title] = process.argv;
  if (!slug || !title) {
    console.error('usage: tsx scripts/seed-case-study.ts <slug> "<Title>"');
    process.exit(1);
  }

  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    console.log(`[seed-case-study] slug "${slug}" already exists (id=${existing.id})`);
    return;
  }

  const candidate = await prisma.project.findFirst({
    where: { slug: { startsWith: "untitled-project" } },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) {
    console.error("[seed-case-study] no untitled-project to repurpose");
    process.exit(1);
  }

  const updated = await prisma.project.update({
    where: { id: candidate.id },
    data: {
      slug,
      title,
      description:
        candidate.description ||
        "Demo project to exercise the case-study wiring.",
    },
  });
  console.log(
    `[seed-case-study] renamed ${candidate.slug} → ${updated.slug} ("${updated.title}")`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
