/**
 * Tool registry. Both the stdio entrypoint (server.ts) and the HTTP route
 * (../http.ts) build their MCP server by iterating this list and calling
 * `registerTool(name, config, handler)`. Single source of truth for tool
 * names, descriptions, schemas, and handler bodies.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PortfolioClient } from "../client.js";
import {
  appendToSurfaceInput,
  createProjectInput,
  createSurfaceInput,
  getProjectInput,
  listProjectsInput,
  listSurfacesInput,
  updatePageInput,
  updateProjectInput,
  updateSurfaceBodyInput,
  uploadAssetInput,
} from "../schemas.js";
import { assetTools } from "./assets.js";
import { pageTools } from "./pages.js";
import { projectTools } from "./projects.js";
import { surfaceTools } from "./surfaces.js";

export function registerAllTools(server: McpServer, client: PortfolioClient) {
  const projects = projectTools(client);
  const surfaces = surfaceTools(client);
  const pages = pageTools(client);
  const assets = assetTools(client);

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List every project on the portfolio. Returns id, slug, title, description, and parent id. Use this first to resolve a slug to an id, or to confirm a project exists before writing.",
      inputSchema: listProjectsInput,
    },
    async () => projects.listProjects()
  );

  server.registerTool(
    "get_project",
    {
      title: "Get a project",
      description:
        "Fetch a single project's full record by id or slug. Includes title, description, legacy body, hero, source URL, and ordering metadata. Use this before update_project to merge rather than clobber.",
      inputSchema: getProjectInput,
    },
    async (args) => projects.getProject(args)
  );

  server.registerTool(
    "create_project",
    {
      title: "Create a project",
      description:
        "Create a new project tile. A default 'overview' surface is created with it. To populate content, follow up with update_surface_body or append_to_surface_body on the overview surface.",
      inputSchema: createProjectInput,
    },
    async (args) => projects.createProject(args)
  );

  server.registerTool(
    "update_project",
    {
      title: "Update a project",
      description:
        "Patch metadata on an existing project: title, slug, description, sourceUrl, heroImageUrl, body (legacy long-form), isOpenable. Fields omitted from the input are left unchanged. Prefer Surfaces over the legacy body field.",
      inputSchema: updateProjectInput,
    },
    async (args) => projects.updateProject(args)
  );

  server.registerTool(
    "list_surfaces",
    {
      title: "List surfaces",
      description:
        "List the surfaces (tabs) of a project. Each surface has its own markdown body. Bodies are NOT returned here to keep the listing small — use get_project / append_to_surface_body to read or write.",
      inputSchema: listSurfacesInput,
    },
    async (args) => surfaces.listSurfaces(args)
  );

  server.registerTool(
    "create_surface",
    {
      title: "Create a surface",
      description:
        "Add a new tab to a project (e.g. 'Web', 'Mobile', 'Recent work'). Slug is derived from the name unless provided.",
      inputSchema: createSurfaceInput,
    },
    async (args) => surfaces.createSurface(args)
  );

  server.registerTool(
    "update_surface_body",
    {
      title: "Replace a surface body",
      description:
        "Replace the entire markdown body of a surface. Destructive — for section-level edits use append_to_surface_body instead.",
      inputSchema: updateSurfaceBodyInput,
    },
    async (args) => surfaces.updateSurfaceBody(args)
  );

  server.registerTool(
    "append_to_surface_body",
    {
      title: "Upsert a section in a surface",
      description:
        "The main editorial entry point. Adds or replaces an H2 (or H3) section in a surface's markdown body. Case-insensitive heading match. By default replaces in place; pass mode='append' for changelog-style logs.",
      inputSchema: appendToSurfaceInput,
    },
    async (args) => surfaces.appendToSurfaceBody(args)
  );

  server.registerTool(
    "update_page",
    {
      title: "Update a nomo page",
      description:
        "Replace the body of a nomo-style markdown page (e.g. 'home', 'cv'). Note: this endpoint currently requires the owner cookie session on the backend; bearer tokens may receive 401 until that is widened.",
      inputSchema: updatePageInput,
    },
    async (args) => pages.updatePage(args)
  );

  server.registerTool(
    "upload_asset",
    {
      title: "Upload an asset",
      description:
        "Upload an image or video to R2. Accepts either a local path or a remote URL (which is fetched and re-uploaded). Returns the public URL — feed it into update_project.heroImageUrl or embed it in markdown.",
      inputSchema: uploadAssetInput,
    },
    async (args) => assets.uploadAsset(args)
  );
}
