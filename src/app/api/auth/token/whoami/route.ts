import { NextResponse } from "next/server";
import { isOwnerOrBearer } from "@/lib/extension-auth";

/**
 * Used by the snapshot extension to verify its token works.
 * Owner cookie also accepted so the browser-side options page can ping too.
 */
export async function GET(req: Request) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
