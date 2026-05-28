import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** PUT — overwrite the per-view markdown body. Body: `{ aboutBody: string }`.
 *  Used by the view-editor's inline NomoEditor so each view has its own
 *  intro copy independent of `human.md`. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const data = (await req.json()) as { aboutBody?: string };
  if (typeof data.aboutBody !== "string") {
    return NextResponse.json(
      { error: "aboutBody must be a string" },
      { status: 400 }
    );
  }
  const view = await prisma.view.update({
    where: { id },
    data: { aboutBody: data.aboutBody },
  });
  return NextResponse.json({ id: view.id, aboutBody: view.aboutBody });
}
