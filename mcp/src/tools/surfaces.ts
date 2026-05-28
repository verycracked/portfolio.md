import type { PortfolioClient } from "../client.js";
import { mergeSection, type MergeMode } from "../merge.js";
import {
  resolveProject,
  resolveSurface,
  toolError,
  toolResult,
  type ProjectRef,
  type SurfaceRef,
} from "./shared.js";

export function surfaceTools(client: PortfolioClient) {
  return {
    async listSurfaces(input: ProjectRef) {
      try {
        const project = await resolveProject(client, input);
        const surfaces = await client.listSurfaces(project.id);
        // Body is usually long — strip it from the listing so the agent
        // doesn't pay for it when all they wanted was an inventory. The
        // get/append flow reads the body directly via listSurfaces too,
        // but only after the agent has narrowed to one.
        return toolResult(
          surfaces.map((s) => ({
            id: s.id,
            slug: s.slug,
            name: s.name,
            description: s.description,
            order: s.order,
            heroImageUrl: s.heroImageUrl,
            bodyLength: s.body.length,
            updatedAt: s.updatedAt,
          }))
        );
      } catch (err) {
        return toolError(err);
      }
    },

    async createSurface(input: ProjectRef & { name: string; slug?: string }) {
      try {
        const project = await resolveProject(client, input);
        const surface = await client.createSurface(project.id, {
          name: input.name,
          slug: input.slug,
        });
        return toolResult({
          id: surface.id,
          slug: surface.slug,
          name: surface.name,
          projectId: surface.projectId,
        });
      } catch (err) {
        return toolError(err);
      }
    },

    async updateSurfaceBody(
      input: ProjectRef & SurfaceRef & { body: string }
    ) {
      try {
        const project = await resolveProject(client, input);
        const surface = await resolveSurface(client, project.id, input);
        const updated = await client.updateSurface(project.id, surface.id, {
          body: input.body,
        });
        return toolResult({
          id: updated.id,
          slug: updated.slug,
          bodyLength: updated.body.length,
          updatedAt: updated.updatedAt,
        });
      } catch (err) {
        return toolError(err);
      }
    },

    async appendToSurfaceBody(
      input: ProjectRef &
        SurfaceRef & {
          section: string;
          content: string;
          mode?: MergeMode;
          dated?: boolean;
          headingLevel?: 2 | 3;
        }
    ) {
      try {
        const project = await resolveProject(client, input);
        const surface = await resolveSurface(client, project.id, input);
        const { body, outcome } = mergeSection(
          surface.body,
          input.section,
          input.content,
          {
            level: input.headingLevel ?? 2,
            mode: input.mode ?? "replace",
            dated: input.dated ?? true,
          }
        );
        const updated = await client.updateSurface(project.id, surface.id, {
          body,
        });
        return toolResult({
          outcome,
          surface: {
            id: updated.id,
            slug: updated.slug,
            bodyLength: updated.body.length,
          },
          section: input.section,
          updatedAt: updated.updatedAt,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  };
}
