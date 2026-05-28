import type { PortfolioClient } from "../client.js";
import {
  resolveProject,
  toolError,
  toolResult,
  type ProjectRef,
} from "./shared.js";

export function projectTools(client: PortfolioClient) {
  return {
    async listProjects() {
      try {
        const projects = await client.listProjects();
        return toolResult(projects);
      } catch (err) {
        return toolError(err);
      }
    },

    async getProject(input: ProjectRef) {
      try {
        const project = await resolveProject(client, input);
        return toolResult(project);
      } catch (err) {
        return toolError(err);
      }
    },

    async createProject(input: {
      title: string;
      description?: string;
      sourceUrl?: string;
      heroImageUrl?: string;
      groupId?: string;
      parentId?: string;
      isOpenable?: boolean;
    }) {
      try {
        const created = await client.createProject(input);
        return toolResult({
          id: created.id,
          slug: created.slug,
          title: created.title,
          note: "Created with a default 'overview' surface. Use list_surfaces to inspect.",
        });
      } catch (err) {
        return toolError(err);
      }
    },

    async updateProject(
      input: ProjectRef & {
        title?: string;
        slug?: string;
        description?: string;
        body?: string;
        sourceUrl?: string | null;
        heroImageUrl?: string | null;
        isOpenable?: boolean;
      }
    ) {
      try {
        const project = await resolveProject(client, input);
        // Drop the discriminator fields from the patch — they were used to
        // resolve the project and aren't valid columns on the row.
        const patch: Record<string, unknown> = { ...input };
        delete patch.projectId;
        delete patch.projectSlug;
        const updated = await client.updateProject(project.id, patch);
        return toolResult({
          id: updated.id,
          slug: updated.slug,
          title: updated.title,
          updatedAt: updated.updatedAt,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  };
}
