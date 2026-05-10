import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_ID = "main";

type Body = {
  contentJson?: unknown;
  contentMd?: string;
};

export async function PUT(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const data = {
    contentJson: body.contentJson as never,
    contentMd: body.contentMd ?? "",
  };

  const page = await prisma.page.upsert({
    where: { id: PAGE_ID },
    update: data,
    create: { id: PAGE_ID, ...data },
  });

  return NextResponse.json(page);
}
