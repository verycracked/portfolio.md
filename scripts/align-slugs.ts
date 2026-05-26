/**
 * One-shot: realign each Project's slug with its (slugified) title so the
 * URLs read sensibly (`/projects/coderabbit` instead of `/projects/starbase`
 * for a project titled "CodeRabbit").
 *
 * Two-phase update to dodge unique-constraint violations when one project's
 * desired slug is currently held by another:
 *   phase 1 → every changing project moves to a temporary slug (`__tmp__<id>`)
 *   phase 2 → each one is renamed to its final desired slug
 *
 * Usage:
 *   pnpm exec tsx scripts/align-slugs.ts          # dry run, prints the plan
 *   pnpm exec tsx scripts/align-slugs.ts --apply  # actually rename
 */
import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/slug";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, title: true },
  });

  const claimed = new Set<string>();
  const changes: { id: string; from: string; to: string }[] = [];

  for (const p of projects) {
    const base = slugify(p.title);
    if (!base) continue; // skip empty / unsluggable titles
    if (p.slug === base && !claimed.has(base)) {
      claimed.add(p.slug);
      continue;
    }
    let candidate = base;
    let n = 2;
    while (claimed.has(candidate)) {
      candidate = `${base}-${n++}`;
    }
    claimed.add(candidate);
    if (p.slug !== candidate) {
      changes.push({ id: p.id, from: p.slug, to: candidate });
    }
  }

  if (changes.length === 0) {
    console.log("[align-slugs] all slugs already match titles");
    return;
  }

  console.log("[align-slugs] planned changes:");
  for (const c of changes) console.log(`  ${c.from.padEnd(28)} → ${c.to}`);

  if (!apply) {
    console.log("[align-slugs] dry run — rerun with --apply to commit");
    return;
  }

  console.log("[align-slugs] phase 1: tmp slugs");
  for (const c of changes) {
    await prisma.project.update({
      where: { id: c.id },
      data: { slug: `__tmp__${c.id}` },
    });
  }

  console.log("[align-slugs] phase 2: final slugs");
  for (const c of changes) {
    await prisma.project.update({
      where: { id: c.id },
      data: { slug: c.to },
    });
  }

  console.log("[align-slugs] done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
