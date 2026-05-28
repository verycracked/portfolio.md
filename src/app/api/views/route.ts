import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueViewSlug } from "@/lib/view-helpers";
import { seedViewFromMain } from "@/lib/view-seed";

/** GET — owner-only list of all saved views. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const views = await prisma.view.findMany({
    orderBy: [{ createdAt: "desc" }],
  });
  return NextResponse.json(views);
}

/** POST — create a new view. Body: `{ name?: string }`. Sensible defaults
 *  (showAbout + showProjects on, no filters) so the owner just picks a name
 *  and starts editing. */
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim() || "Untitled view";

  const slug = await uniqueViewSlug(name);
  const view = await prisma.view.create({
    data: {
      slug,
      name,
      projectIds: [],
      groupIds: [],
    },
  });
  // Deep-copy the main page into the new view so the owner starts with
  // a working snapshot they can mutate independently. Best-effort: if
  // seeding fails for any reason, we still hand the view back to the
  // client so the owner can populate it manually.
  await seedViewFromMain(view.id).catch((err) => {
    console.error("[views] seed failed", err);
  });
  return NextResponse.json(view);
}
