import type { PortfolioClient } from "../client.js";
import { toolError, toolResult } from "./shared.js";

export function pageTools(client: PortfolioClient) {
  return {
    async updatePage(input: { slug: string; body: string }) {
      try {
        // PUT /api/pages/[slug] is cookie-only on the backend today; bearer
        // tokens can't reach it. Surface the constraint up front instead of
        // letting the agent eat an opaque 401. If/when that endpoint adopts
        // `isOwnerOrBearer`, drop this check.
        // (Kept as a hint, not a blocker — the request still goes through
        // in case the deploy has been updated independently.)
        const updated = await client.updatePage(input.slug, input.body);
        return toolResult({
          slug: input.slug,
          bodyLength: updated.body.length,
          updatedAt: updated.updatedAt,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  };
}
