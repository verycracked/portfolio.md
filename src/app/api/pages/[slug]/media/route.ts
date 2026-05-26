import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Rewrite the markdown body for `slug` so its standalone `![](…)` lines
 * appear in the order given by `urls`. Lines that no longer have a URL in
 * the new list are removed (single-step delete). The non-media content
 * around the images keeps its original position so the page's prose stays
 * exactly where the owner left it.
 *
 * Body: `{ urls: string[] }` — the new ordered media URL list.
 */

const PLAIN_IMG_LINE = /^[ \t]*!\[\]\(([^)\s]+?)\)[ \t]*$/;
const REMOVE_MARKER = "\u0000__remove__\u0000";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const payload = (await req.json().catch(() => ({}))) as { urls?: unknown };
  const urls = payload.urls;
  if (!Array.isArray(urls) || urls.some((u) => typeof u !== "string")) {
    return NextResponse.json({ error: "urls array required" }, { status: 400 });
  }

  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const lines = page.body.split("\n");
  // Find every line that's currently a plain image; we'll overwrite them in
  // their existing positions with the new ordered URLs.
  const mediaLineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (PLAIN_IMG_LINE.test(lines[i])) mediaLineIndices.push(i);
  }

  let urlIdx = 0;
  for (const lineIdx of mediaLineIndices) {
    if (urlIdx < urls.length) {
      lines[lineIdx] = `![](${urls[urlIdx] as string})`;
      urlIdx += 1;
    } else {
      // Caller dropped this URL — remove the line entirely so we don't leave
      // a stale image hanging around.
      lines[lineIdx] = REMOVE_MARKER;
    }
  }

  // If the caller supplied more URLs than the body had slots for (e.g. race
  // with a fresh upload), append the extras at the end so we don't lose them.
  while (urlIdx < urls.length) {
    lines.push("", `![](${urls[urlIdx] as string})`);
    urlIdx += 1;
  }

  const next = lines
    .filter((l) => l !== REMOVE_MARKER)
    .join("\n")
    // Collapse triple+ blank runs left behind by deletes.
    .replace(/\n{3,}/g, "\n\n");

  const updated = await prisma.page.update({
    where: { slug },
    data: { body: next },
  });

  return NextResponse.json({ body: updated.body });
}
