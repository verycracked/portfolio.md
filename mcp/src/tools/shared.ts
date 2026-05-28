/**
 * Cross-cutting helpers shared by every tool handler.
 *
 *  - `resolveProject` accepts either `projectId` or `projectSlug` (per the
 *    schemas) and resolves to a concrete id. The whole MCP is built around
 *    this convention so the agent can address things by either key.
 *  - `resolveSurface` is the matching helper for surfaces, resolving a
 *    surface-by-id or surface-by-slug-within-project.
 *  - `toolResult` wraps a value into the MCP `CallToolResult` shape with a
 *    canonical text rendering — JSON for objects, the string as-is for text.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PortfolioClient, Project, Surface } from "../client.js";
import { PortfolioApiError } from "../client.js";

export type ProjectRef = {
  projectId?: string;
  projectSlug?: string;
};

export async function resolveProject(
  client: PortfolioClient,
  ref: ProjectRef
): Promise<Project> {
  if (ref.projectId) {
    return client.getProject(ref.projectId);
  }
  if (ref.projectSlug) {
    // Resolve slug → id via the list, then fetch the full row. The
    // list endpoint is the only one that lets us look up by slug without
    // also pulling the body+assets payload the /api/project/[slug] route
    // returns, which is what we want here (small probe).
    const list = await client.listProjects();
    const hit = list.find((p) => p.slug === ref.projectSlug);
    if (!hit) {
      throw new Error(
        `project with slug "${ref.projectSlug}" not found. Use list_projects to see available slugs.`
      );
    }
    return client.getProject(hit.id);
  }
  throw new Error(
    "either projectId or projectSlug must be provided"
  );
}

export type SurfaceRef = {
  surfaceId?: string;
  surfaceSlug?: string;
};

export async function resolveSurface(
  client: PortfolioClient,
  projectId: string,
  ref: SurfaceRef
): Promise<Surface> {
  const surfaces = await client.listSurfaces(projectId);
  if (ref.surfaceId) {
    const hit = surfaces.find((s) => s.id === ref.surfaceId);
    if (!hit) {
      throw new Error(
        `surface ${ref.surfaceId} not found on project ${projectId}. Use list_surfaces to see available surfaces.`
      );
    }
    return hit;
  }
  if (ref.surfaceSlug) {
    const hit = surfaces.find((s) => s.slug === ref.surfaceSlug);
    if (!hit) {
      throw new Error(
        `surface with slug "${ref.surfaceSlug}" not found on project ${projectId}. Use list_surfaces to see available surfaces.`
      );
    }
    return hit;
  }
  throw new Error("either surfaceId or surfaceSlug must be provided");
}

/** Wrap a JS value as the MCP tool result format. */
export function toolResult(value: unknown): CallToolResult {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Translate any thrown error into a structured `isError: true` tool result.
 * The MCP SDK does this automatically for unhandled throws too, but doing
 * it explicitly lets us include the upstream HTTP status code in the body
 * for easier triage.
 */
export function toolError(err: unknown): CallToolResult {
  if (err instanceof PortfolioApiError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `portfolio.md API error (${err.status}): ${err.bodyText || err.message}`,
        },
      ],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
