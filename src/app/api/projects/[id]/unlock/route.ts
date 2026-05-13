import { NextResponse } from "next/server";
import {
  PROJECT_COOKIE_MAX_AGE,
  makeUnlockToken,
  projectCookieName,
  verifyPassword,
} from "@/lib/project-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { passwordHash: true },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!project.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || !verifyPassword(body.password, project.passwordHash)) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const token = makeUnlockToken(id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(projectCookieName(id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROJECT_COOKIE_MAX_AGE,
  });
  return res;
}
