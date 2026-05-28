#!/usr/bin/env node
/**
 * portfolio-md-mcp stdio entrypoint.
 *
 * Config is read from environment variables (set per-client in the MCP host's
 * config file — Claude Desktop's claude_desktop_config.json, Cursor's MCP
 * settings, etc.):
 *
 *   PORTFOLIO_URL    Base URL of the deploy. Required.
 *   PORTFOLIO_TOKEN  Bearer token minted at /settings on the deploy. Required.
 *
 * If either is missing we bail out with a clear message instead of starting
 * a half-broken server that the host would just keep retrying.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

const PACKAGE_NAME = "portfolio-md-mcp";
const PACKAGE_VERSION = "0.1.0";

function die(message: string): never {
  // Write to stderr — stdout is reserved for MCP protocol traffic over stdio.
  process.stderr.write(`[${PACKAGE_NAME}] ${message}\n`);
  process.exit(1);
}

async function main() {
  const baseUrl = process.env.PORTFOLIO_URL;
  const token = process.env.PORTFOLIO_TOKEN;
  if (!baseUrl) die("PORTFOLIO_URL is required");
  if (!token) die("PORTFOLIO_TOKEN is required");

  const client = createClient({ baseUrl, token });
  const server = new McpServer(
    { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    {
      // Surface a useful set of capabilities. Resources/prompts aren't
      // implemented yet — tools-only for v1.
      capabilities: { tools: {} },
    }
  );
  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // The SDK closes itself on EOF, but be defensive against SIGTERM from the
  // host so we don't leave a half-closed transport behind.
  const shutdown = async () => {
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  process.stderr.write(
    `[${PACKAGE_NAME}] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`
  );
  process.exit(1);
});
