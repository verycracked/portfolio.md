/**
 * HTTP MCP transport — used by the in-app `/api/mcp` route so external AI
 * clients can talk to the same tool registry without installing anything
 * locally. Stateless: one transport + one McpServer per request, torn down
 * when the response completes.
 *
 * Auth is the same `Authorization: Bearer <token>` header the rest of the
 * portfolio.md API uses, validated against the existing ExtensionToken
 * table by the caller before invoking `handleMcpRequest`. We don't re-check
 * here — that's the caller's job because they own the prisma instance.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

export type HandleMcpRequestOptions = {
  /** Bearer token the caller has already validated. Forwarded to the API. */
  token: string;
  /**
   * Base URL the MCP should hit when proxying to the portfolio.md API. In
   * practice this is the same deploy that's serving the MCP HTTP route, so
   * we default to the request's own origin — see the Next route for the
   * derivation.
   */
  baseUrl: string;
  /** Server name surfaced in MCP `initialize`. */
  name?: string;
  /** Server version surfaced in MCP `initialize`. */
  version?: string;
};

export async function handleMcpRequest(
  request: Request,
  options: HandleMcpRequestOptions
): Promise<Response> {
  const server = new McpServer(
    {
      name: options.name ?? "portfolio-md-mcp",
      version: options.version ?? "0.1.0",
    },
    { capabilities: { tools: {} } }
  );

  const client = createClient({
    baseUrl: options.baseUrl,
    token: options.token,
  });
  registerAllTools(server, client);

  // Stateless mode — `sessionIdGenerator: undefined` means each request is
  // independent. Matches the way Cursor / Claude Desktop talk over HTTP and
  // sidesteps the bookkeeping of long-lived sessions. JSON responses (not
  // SSE) keep the Next route trivially compatible with `Response` returns.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  // Connecting starts the transport's internal request listener; we hand
  // it the Request and let it produce a Response. The McpServer holds the
  // transport, so closing the server tears it down.
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Stateless: close immediately so we don't leak per-request handlers
    // across cold/warm Vercel instances.
    await server.close().catch(() => {
      // Swallow — the response has already been sent.
    });
  }
}
