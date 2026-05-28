import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/** Append `-2`, `-3`, … to the desired slug until it's unique across the
 *  View table. Mirrors the helper we have for projects / surfaces. */
export async function uniqueViewSlug(
  desired: string,
  ignoreId?: string
): Promise<string> {
  const base = slugify(desired) || "view";
  let candidate = base;
  let n = 2;
  // Bounded loop — won't realistically iterate more than a handful of
  // times. Capped at 64 attempts so a truly degenerate workload still
  // terminates.
  for (let i = 0; i < 64; i++) {
    const existing = await prisma.view.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${n++}`;
  }
  throw new Error("could not find unique view slug");
}

/** Narrow the Prisma `Json` field into a string[] safely. */
export function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
