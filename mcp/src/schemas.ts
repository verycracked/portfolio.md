/**
 * Zod schemas for every tool's input shape. The MCP SDK takes a `ZodRawShape`
 * (a record of field-name → ZodType) on `registerTool` and derives a JSON
 * Schema from it for the client. We define raw shapes here so the same shape
 * can be reused for runtime validation in the HTTP transport.
 *
 * Keep field-level `.describe()` calls — they show up in the agent-visible
 * tool documentation and are the cheapest way to make the tools self-explanatory.
 */
import { z } from "zod";

// A project reference accepts either an id (cuid) or a slug. Tool handlers
// normalize via `resolveProject` in tools/projects.ts.
export const projectRef = {
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe("The project's id (cuid). Provide this OR projectSlug."),
  projectSlug: z
    .string()
    .min(1)
    .optional()
    .describe("The project's slug, e.g. \"starbase\". Provide this OR projectId."),
};

export const listProjectsInput = {};

export const getProjectInput = projectRef;

export const createProjectInput = {
  title: z.string().min(1).describe("Display title for the new project."),
  description: z
    .string()
    .optional()
    .describe("Short blurb shown under the title on the homepage tile."),
  sourceUrl: z
    .string()
    .url()
    .optional()
    .describe("External link for the project (e.g. live site, repo)."),
  heroImageUrl: z
    .string()
    .url()
    .optional()
    .describe("Public URL of an image/video to use as the homepage tile cover."),
  groupId: z
    .string()
    .optional()
    .describe(
      "Optional section/group id to drop the new tile into. Defaults to the last group."
    ),
  parentId: z
    .string()
    .optional()
    .describe(
      "When set, the new tile becomes a sub-project of this parent. Mutually exclusive with groupId."
    ),
  isOpenable: z
    .boolean()
    .optional()
    .describe(
      "If true, the homepage tile is clickable to the project detail page even with no sub-projects. Default false."
    ),
};

export const updateProjectInput = {
  ...projectRef,
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  body: z
    .string()
    .optional()
    .describe(
      "Legacy long-form project body. Most copy should live on a Surface instead — use update_surface_body."
    ),
  sourceUrl: z.string().url().nullable().optional(),
  heroImageUrl: z.string().url().nullable().optional(),
  isOpenable: z.boolean().optional(),
};

export const listSurfacesInput = projectRef;

export const createSurfaceInput = {
  ...projectRef,
  name: z.string().min(1).describe("Display name for the new tab, e.g. \"Web\" or \"Mobile\"."),
  slug: z
    .string()
    .optional()
    .describe("Optional URL slug. Defaults to a slugified version of the name."),
};

export const updateSurfaceBodyInput = {
  ...projectRef,
  surfaceId: z
    .string()
    .min(1)
    .optional()
    .describe("Surface id to write to. Provide this OR surfaceSlug."),
  surfaceSlug: z
    .string()
    .min(1)
    .optional()
    .describe("Surface slug (e.g. \"overview\"). Provide this OR surfaceId."),
  body: z
    .string()
    .describe(
      "Full markdown body for the surface. Replaces existing content. Use append_to_surface_body for section-level merges."
    ),
};

export const appendToSurfaceInput = {
  ...projectRef,
  surfaceId: z.string().min(1).optional(),
  surfaceSlug: z.string().min(1).optional(),
  section: z
    .string()
    .min(1)
    .describe(
      "H2 heading text to upsert. Match is case-insensitive against existing headings."
    ),
  content: z
    .string()
    .describe(
      "Markdown body for the section (without the heading itself). Becomes the body under the H2."
    ),
  mode: z
    .enum(["replace", "append"])
    .optional()
    .default("replace")
    .describe(
      "\"replace\" rewrites the section if it exists, otherwise appends. \"append\" always appends — useful for changelog-style sections."
    ),
  dated: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "When true, inserts an italic YYYY-MM-DD line under the H2. Disable for evergreen content."
    ),
  headingLevel: z
    .union([z.literal(2), z.literal(3)])
    .optional()
    .default(2)
    .describe("Heading level for the section. Defaults to H2 to match existing convention."),
};

export const updatePageInput = {
  slug: z.string().min(1).describe("Page slug, e.g. \"home\" or \"cv\"."),
  body: z.string().describe("Full markdown body. Replaces existing content."),
};

export const uploadAssetInput = {
  path: z
    .string()
    .optional()
    .describe("Absolute local file path to upload. Provide this OR url."),
  url: z
    .string()
    .url()
    .optional()
    .describe("Remote URL to fetch and re-upload. Provide this OR path."),
  filename: z
    .string()
    .optional()
    .describe("Override the stored filename. Defaults to the source basename."),
  projectSlug: z
    .string()
    .optional()
    .describe(
      "Attach the asset to this project (created on demand if it doesn't exist)."
    ),
  projectName: z
    .string()
    .optional()
    .describe("Display name used when creating a new project for the asset."),
};

/** Helper: type-only export of a raw-shape's inferred output. */
export type Shape = Record<string, z.ZodTypeAny>;
export type InferShape<S extends Shape> = {
  [K in keyof S]: z.infer<S[K]>;
};
