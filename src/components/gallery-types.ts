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
 * Every gallery tile is now a perfect square, single uniform size.
 * The old col/row span fields stay on the row for back-compat (and so
 * existing data doesn't blow up), but the public face is one shape.
 * `spanClass` is kept so callers don't all need to change at once —
 * it just returns the square-aspect utility regardless of inputs.
 */
export function spanClass(_colSpan: number, _rowSpan: number): string {
  return "aspect-square";
}
