// Shared type for pills in `content/human.md` that match a portfolio project
// by slug. Lives in its own module so client components can import the type
// without dragging in the server-side renderer.

export type ProjectSummary = {
  slug: string;
  title: string;
  description: string;
  /** Hero of the project's first surface, if any. Used in the hover tooltip. */
  heroImageUrl: string | null;
  /** First surface's slug — needed to build /projects/<slug>/<surfaceSlug>. */
  firstSurfaceSlug: string;
  /** True when the project carries a password gate. */
  isProtected: boolean;
};
