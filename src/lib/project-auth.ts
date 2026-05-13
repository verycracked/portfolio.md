import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_DAYS = 30;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return s;
}

function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

/** Stable hash of a password for storage on Project.passwordHash. */
export function hashPassword(raw: string): string {
  return hmac(`pwd.${raw}`);
}

/** Constant-time compare against stored hash. */
export function verifyPassword(raw: string, hash: string): boolean {
  const candidate = hashPassword(raw);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const cookieName = (projectId: string) => `pmd_proj_${projectId}`;

export function makeUnlockToken(projectId: string): string {
  const exp = Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${projectId}.${exp}`;
  return `${payload}.${hmac(payload)}`;
}

function verifyUnlockToken(projectId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [pid, expStr, sig] = parts;
  if (pid !== projectId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = hmac(`${pid}.${expStr}`);
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
}

export async function isProjectUnlocked(projectId: string): Promise<boolean> {
  const jar = await cookies();
  return verifyUnlockToken(projectId, jar.get(cookieName(projectId))?.value);
}

export const PROJECT_COOKIE_MAX_AGE = TTL_SECONDS;
export const projectCookieName = cookieName;
