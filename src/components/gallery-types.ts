export type GalleryProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string | null;
  /** First-frame still for videos. Null for image heroes and for legacy
   *  video uploads that predate poster extraction. */
  posterUrl: string | null;
  /** Owner opted-in to expose "Play" CTA + theater modal. Off by default. */
  hasAudio: boolean;
  /** Owner opted-in to make the homepage tile clickable even without
   *  children — useful for stand-alone projects that have a write-up. */
  isOpenable: boolean;
  isProtected: boolean;
  /** Number of sub-projects under this tile. childCount > 0 OR isOpenable
   *  makes the visitor card link to the detail page. */
  childCount: number;
  /** 1–4 — number of grid columns this card occupies horizontally. */
  colSpan: number;
  /** 1–2 — number of grid rows this card occupies vertically. */
  rowSpan: number;
};

export type GalleryGroup = {
  id: string;
  slug: string;
  name: string;
  order: number;
  projects: GalleryProject[];
};

/**
 * Two tile shapes:
 *   • `colSpan === 1` → 1 column wide, perfect square (aspect-square)
 *   • `colSpan === 2` → 2 columns wide, 2:1 wide rectangle so the row
 *     height still matches the neighboring squares (no jagged tracks).
 *
 * `rowSpan` is preserved on the row for back-compat but doesn't affect
 * the rendered shape anymore — vertical sizing comes from the aspect
 * ratio of whichever shape was chosen. Resize handle in the editor
 * snaps to one of these two presets.
 */
export function spanClass(colSpan: number, _rowSpan: number): string {
  if (colSpan >= 2) return "sm:col-span-2 sm:aspect-[2/1]";
  return "aspect-square";
}
