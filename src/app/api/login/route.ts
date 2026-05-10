import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
  makeSessionToken,
} from "@/lib/auth";

function safeEqual(a: string, b: string) {
  const buf1 = Buffer.from(a);
  const buf2 = Buffer.from(b);
  if (buf1.length !== buf2.length) return false;
  return timingSafeEqual(buf1, buf2);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.OWNER_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "OWNER_PASSWORD not set" }, { status: 500 });
  }
  if (!body.password || !safeEqual(body.password, expected)) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  const token = makeSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return res;
}
