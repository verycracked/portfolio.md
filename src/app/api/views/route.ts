import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";
import { uniqueViewSlug } from "@/lib/view-helpers";
import { seedViewFromMain, duplicateView } from "@/lib/view-seed";

/** GET — list all saved views. Owner OR a valid extension bearer (the
 *  snapshot extension calls this to populate its "Save to" picker). */
export async function GET(req: Request) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const views = await prisma.view.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, slug: true, name: true, greeting: true },
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
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    /** When set, clone this view instead of seeding from the main page. */
    duplicateFrom?: string;
  };
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

  if (body.duplicateFrom) {
    await duplicateView(body.duplicateFrom, view.id).catch((err) => {
      console.error("[views] duplicate failed", err);
    });
  } else {
    await seedViewFromMain(view.id).catch((err) => {
      console.error("[views] seed failed", err);
    });
  }
  return NextResponse.json(view);
}
