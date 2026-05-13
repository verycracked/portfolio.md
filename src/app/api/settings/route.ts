import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "main";

type Body = {
  avatarUrl?: string | null;
};

export async function PUT(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as Body;

  const data = {
    ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
  };

  const settings = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });

  return NextResponse.json(settings);
}
