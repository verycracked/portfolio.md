# portfolio-md-mcp

Model Context Protocol server for **any [portfolio.md](https://github.com/) deploy** — let AI agents push session notes, project copy, and assets straight into your portfolio without copy-pasting markdown.

Point it at your own deploy. The server is stateless and config-less beyond a base URL and a bearer token, so the same `npx portfolio-md-mcp` works for every portfolio.md install.

Tested with Claude Desktop, Claude Code, and Cursor. Also speaks Streamable HTTP MCP, so any HTTP-capable client can hit `https://<your-deploy>/api/mcp` directly with no local install.

## What it does

Exposes a small, opinionated toolkit over MCP:

| Tool                       | Use it for                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `list_projects`            | Find projects by slug → id.                                                               |
| `get_project`              | Read a project's current state before editing.                                            |
| `create_project`           | Mint a new project tile (with a default `overview` surface).                              |
| `update_project`           | Patch title, description, sourceUrl, heroImageUrl, etc.                                   |
| `list_surfaces`            | List the tabs of a project. Bodies omitted for size.                                      |
| `create_surface`           | Add a new tab (e.g. `Web`, `Mobile`, `Recent work`).                                      |
| `update_surface_body`      | Replace the whole markdown body of a surface.                                             |
| `append_to_surface_body`   | The main editorial tool — upsert an H2/H3 section by name. Idempotent. Optional date stamp. |
| `update_page`              | Rewrite a nomo page (`home`, `cv`).                                                       |
| `upload_asset`             | Push an image/video to R2 from a local path or remote URL.                                |

The headline tool is `append_to_surface_body`. It reads the surface's current body, finds an existing H2 with the section name (case-insensitive), and either replaces in place (default) or appends a duplicate. Same input twice → same output. Safe to call from autopilot.

## Setup

### 1. Mint a token

In your deploy, log into `/lock`, then visit `/settings`. Click **New token** with a label like `claude-desktop` and copy the `pmd_…` string — you won't see it again.

### 2. Configure your MCP client

**Claude Desktop / Cursor** (`claude_desktop_config.json` or the equivalent):

```json
{
  "mcpServers": {
    "portfolio.md": {
      "command": "npx",
      "args": ["-y", "portfolio-md-mcp"],
      "env": {
        "PORTFOLIO_URL": "https://your-portfolio.com",
        "PORTFOLIO_TOKEN": "pmd_xxx"
      }
    }
  }
}
```

**Claude Code** (`~/.claude.json` or per-project `.mcp.json`):

```json
{
  "mcpServers": {
    "portfolio.md": {
      "command": "npx",
      "args": ["-y", "portfolio-md-mcp"],
      "env": {
        "PORTFOLIO_URL": "https://your-portfolio.com",
        "PORTFOLIO_TOKEN": "pmd_xxx"
      }
    }
  }
}
```

**Streamable HTTP MCP client** (any client that supports the URL transport — no install needed):

```
URL:    https://your-portfolio.com/api/mcp
Header: Authorization: Bearer pmd_xxx
```

### 3. Try it

In your AI client, ask: *"Use the portfolio.md MCP to log today's session under 'Recent work' on the `coderabbit` project's overview surface."*

The agent picks `append_to_surface_body` with `projectSlug: "coderabbit"`, `surfaceSlug: "overview"`, `section: "Recent work"`, and a markdown bullet list it composed itself. Two seconds later it's live on the site.

## Conventions the tools follow

`append_to_surface_body` matches the existing surface body style:

- Sections are **H2** by default (`## Section name`). Pass `headingLevel: 3` to use `###`.
- An italic date line (`_YYYY-MM-DD_`) is inserted under the heading. Pass `dated: false` for evergreen content.
- The match against existing headings is case- and whitespace-insensitive.
- Replace mode (default) rewrites a same-named section in place; append mode always pushes a duplicate. Use append for changelog-style sections.

The agent has editorial freedom inside the section — bullet style, sub-headings, code blocks, whatever fits.

## Auth model

All tools use the same `Authorization: Bearer <pmd_…>` header validated against the `ExtensionToken` table (same auth surface the Snapshot Chrome extension uses). The owner cookie session is never required for the MCP. Revoke tokens at `/settings` to lock out a client.

Caveats:

- `update_page` currently requires the owner cookie session on the backend; bearer tokens get 401. The tool surfaces the error verbatim. Surfaces are the recommended write target anyway.
- Project deletes are owner-cookie only — the MCP can write and edit, but not delete projects. Intentional blast-radius limit.

## Development

This package lives at `mcp/` in the [portfolio.md repo](https://github.com/). To work on it:

```bash
pnpm install                      # workspace install from the repo root
pnpm --filter portfolio-md-mcp test    # node:test unit tests for the merge logic
pnpm --filter portfolio-md-mcp build   # compile to mcp/dist
pnpm mcp dev                      # tsx src/server.ts — needs PORTFOLIO_URL and PORTFOLIO_TOKEN
```

The HTTP transport route (`src/app/api/mcp/route.ts` in the parent app) imports from `mcp/dist/http.js`, so `pnpm dev` and `pnpm build` automatically rebuild the MCP package first (via `predev` / `prebuild` hooks).

### Inspector

To poke the stdio server directly:

```bash
PORTFOLIO_URL=http://localhost:3000 \
PORTFOLIO_TOKEN=pmd_xxx \
npx @modelcontextprotocol/inspector node mcp/dist/server.js
```

## Publishing

```bash
pnpm --filter portfolio-md-mcp build
cd mcp
npm publish --access public
```

The package ships compiled JS + `.d.ts` from `dist/`, plus this README. Source is on the GitHub repo.
