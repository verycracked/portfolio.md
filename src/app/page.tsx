import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Gallery } from "@/components/gallery";

export default async function Home({
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
      },
    }),
    prisma.settings.findUnique({ where: { id: "main" } }),
  ]);
  const owner = await isAuthed();
  const previewing = preview === "1";

  // Don't leak hashes to the client; expose only a boolean.
  const projects = rows.map(({ passwordHash, ...rest }) => ({
    ...rest,
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
