/**
 * Resolves the API base URLs for the homepage gallery vs. a per-view
 * editor. The gallery + section + card + new-tile components are all
 * scope-agnostic — they take a `GalleryScope` and call these helpers to
 * route reads and writes to the right endpoints.
 *
 *   { kind: "main" }                → /api/projects/..., /api/groups/...
 *   { kind: "view", viewId: "..." } → /api/views/<id>/projects/...,
 *                                     /api/views/<id>/groups/...
 *
 * Same wire shape on both endpoints (the server hands back a row whose
 * fields match what the client gallery models expect), so the client
 * never has to branch on the scope past URL construction.
 */
export type GalleryScope =
  | { kind: "main" }
  | { kind: "view"; viewId: string };

export const MAIN_SCOPE: GalleryScope = { kind: "main" };

export function projectsBase(scope: GalleryScope): string {
  return scope.kind === "main"
    ? "/api/projects"
    : `/api/views/${scope.viewId}/projects`;
}

export function projectsReorder(scope: GalleryScope): string {
  return `${projectsBase(scope)}/reorder`;
}

export function projectUrl(scope: GalleryScope, id: string): string {
  return `${projectsBase(scope)}/${id}`;
}

export function groupsBase(scope: GalleryScope): string {
  return scope.kind === "main"
    ? "/api/groups"
    : `/api/views/${scope.viewId}/groups`;
}

export function groupsReorder(scope: GalleryScope): string {
  return `${groupsBase(scope)}/reorder`;
}

export function groupUrl(scope: GalleryScope, id: string): string {
  return `${groupsBase(scope)}/${id}`;
}
