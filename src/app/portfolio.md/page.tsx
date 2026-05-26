import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Gallery } from "@/components/gallery";

export const metadata: Metadata = {
  title: "portfolio",
};

// The projects gallery. Lives here so `/` can be the nomo-style homepage and
// `/portfolio.md` is the file-style URL the homepage links into.
export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ preview }, rows, settings] = await Promise.all([
    searchParams,
    prisma.project.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        heroImageUrl: true,
        passwordHash: true,
        // Pull just the first surface so the card hero can prefer the
        // active-surface artwork over the legacy project-level hero.
        surfaces: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          take: 1,
          select: { heroImageUrl: true },
        },
      },
    }),
    prisma.settings.findUnique({ where: { id: "main" } }),
  ]);
  const owner = await isAuthed();
  const previewing = preview === "1";

  // Don't leak hashes to the client; expose only a boolean. Prefer the first
  // surface's hero so each card reflects the currently-curated tab; fall back
  // to the legacy project-level hero for projects that pre-date surfaces.
  const projects = rows.map(({ passwordHash, surfaces, heroImageUrl, ...rest }) => ({
    ...rest,
    heroImageUrl: surfaces[0]?.heroImageUrl ?? heroImageUrl,
    isProtected: !!passwordHash,
  }));

  return (
    <Gallery
      initial={projects}
      owner={owner}
      previewing={previewing}
      avatarUrl={settings?.avatarUrl ?? null}
    />
  );
}
