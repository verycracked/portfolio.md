import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mintToken } from "@/lib/extension-auth";

/** GET — list non-revoked tokens (no plaintext, never). */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tokens = await prisma.extensionToken.findMany({
    where: { revoked: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
  return NextResponse.json({ tokens });
}

/** POST — mint a new token. Plaintext is returned once and never again. */
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const { id, token } = await mintToken(body.label);
  return NextResponse.json({ id, token });
}

/** DELETE ?id=… — revoke a token. */
export async function DELETE(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.extensionToken.update({
    where: { id },
    data: { revoked: true },
  });
  return NextResponse.json({ ok: true });
}
