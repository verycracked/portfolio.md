import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { isAuthed } from "./auth";

/** Hash a bearer token for storage. We never persist the plaintext. */
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Mint a new token. Returns the plaintext (caller must show & forget it). */
export async function mintToken(label?: string): Promise<{ id: string; token: string }> {
  // 32 bytes = 256 bits of entropy, encoded as URL-safe base64.
  const random = randomBytes(32).toString("base64url");
  const plaintext = `pmd_${random}`;
  const row = await prisma.extensionToken.create({
    data: {
      label: label?.trim() || "Snapshot extension",
      tokenHash: hashToken(plaintext),
    },
  });
  return { id: row.id, token: plaintext };
}

/**
 * Check if a request carries a valid bearer token. Touches `lastUsedAt` for
 * audit; only on hits. Returns the matched token id, or null.
 */
export async function verifyBearer(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const tokenHash = hashToken(match[1]);
  const row = await prisma.extensionToken.findUnique({ where: { tokenHash } });
  if (!row || row.revoked) return null;
  // Await the touch so it actually commits (fire-and-forget Promises get
  // cancelled when the Next.js request handler resolves). Errors swallowed:
  // we don't want a failed audit write to take down the request.
  try {
    await prisma.extensionToken.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // ignore
  }
  return row.id;
}

/**
 * The unified auth gate used by routes that accept either the owner cookie
 * (browser session) or an extension bearer token. Returns true on either.
 */
export async function isOwnerOrBearer(req: Request): Promise<boolean> {
  if (await isAuthed()) return true;
  return (await verifyBearer(req)) !== null;
}
