import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";

/** Slugify a free-form surface name. Falls back to a short random id. */
export function surfaceSlugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || nanoid(6);
}

/**
 * Returns a slug that's unique within the given project. If the cleaned slug
 * collides with an existing surface, we suffix a short nanoid until it doesn't.
 * `excludeSurfaceId` lets the rename path ignore the surface being updated.
 */
export async function uniqueSurfaceSlug(
  projectId: string,
  raw: string,
  excludeSurfaceId?: string
): Promise<string> {
  const candidate = surfaceSlugify(raw);

  const existing = await prisma.surface.findUnique({
    where: { projectId_slug: { projectId, slug: candidate } },
    select: { id: true },
  });

  if (!existing || existing.id === excludeSurfaceId) {
    return candidate;
  }
  return `${candidate}-${nanoid(4)}`;
}
