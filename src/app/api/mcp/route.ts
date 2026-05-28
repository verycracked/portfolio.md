/**
 * Streamable HTTP MCP transport — lets external AI clients use the
 * portfolio-md MCP without installing anything locally. Same auth as the
 * other bearer-friendly endpoints (extension tokens in `ExtensionToken`).
 *
 * Auth: `Authorization: Bearer pmd_...`
 *
 * Mount this in an MCP client by pointing it at:
 *   <PORTFOLIO_URL>/api/mcp
 * with the bearer header.
 */
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/extension-auth";
// Imports from the compiled MCP package output. Turbopack's resolver doesn't
// rewrite `.js` → `.ts` for files outside `src/` (the MCP package writes
// Node-ESM-compatible `.js` extensions in its source so it can ship to npm
// without a bundler). The `prebuild` / `predev` scripts run `tsc -p mcp/`
// to keep dist/ in sync; if you see "Module not found" here, run
// `pnpm --filter portfolio-md-mcp build`.
import { handleMcpRequest } from "../../../../mcp/dist/http.js";

// Force the Node.js runtime — the MCP SDK uses Node streams + `crypto`
// internals that aren't available in the Edge runtime.
export const runtime = "nodejs";
// MCP is request-scoped; no caching ever.
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string): Response {
  return NextResponse.json({ error: message }, { status });
}

async function handle(req: Request): Promise<Response> {
  const tokenId = await verifyBearer(req);
  if (!tokenId) {
    // The MCP spec says servers should return WWW-Authenticate on 401 so
    // clients know which scheme to use. Cheap to include.
    return new NextResponse(
      JSON.stringify({ error: "missing or invalid bearer token" }),
      {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": 'Bearer realm="portfolio.md"',
        },
      }
    );
  }

  // Pull the raw bearer token out of the header to forward to the same
  // API the MCP normally proxies to. `verifyBearer` only returns the
  // matched ExtensionToken id — we need the plaintext to make subsequent
  // requests authenticate as the same caller.
  const auth = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!match || !match[1]) {
    // Should be impossible since verifyBearer already accepted it, but be
    // defensive — we don't want to send `Bearer undefined` downstream.
    return jsonError(500, "internal: failed to extract bearer token");
  }
  const token = match[1];

  // Compute the base URL the MCP should hit for its own API calls. It's
  // the same deploy serving this route, so the request's origin is the
  // right answer. We don't accept this from headers — that would let an
  // attacker redirect server-to-server traffic.
  const baseUrl = new URL(req.url).origin;

  try {
    return await handleMcpRequest(req, { token, baseUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, `MCP transport error: ${message}`);
  }
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function DELETE(req: Request) {
  // The MCP spec uses DELETE for session termination. We're stateless so
  // there's nothing to clean up — but forward to the transport anyway so
  // the SDK returns the spec-compliant response shape.
  return handle(req);
}
