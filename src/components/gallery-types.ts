export type GalleryProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string | null;
  /** First-frame still for videos. Null for image heroes and for legacy
   *  video uploads that predate poster extraction. */
  posterUrl: string | null;
  /** Optional external link shown as a "Visit ↗" button on tile hover. */
  sourceUrl?: string | null;
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
  /** Optional URL shown as a link next to the section name. */
  linkUrl?: string;
  order: number;
  projects: GalleryProject[];
};

/** Total columns the desktop bento grid uses. Cards span 1..MAX_SPAN of
 *  these. Bumped from the old 2-col bento so the resize handle can
 *  produce a useful range of sizes rather than just two presets. */
export const GRID_COLS = 12;
/** Cap rowSpan / colSpan at the column count — any one tile can take
 *  the whole row. */
export const MAX_SPAN = 12;

/** Free-form sizing: every card sets explicit grid-column and grid-row
 *  spans via inline style. Each cell of the bento is roughly square at
 *  the typical container width, so colSpan === rowSpan === N looks
 *  square; non-equal spans give rectangles. */
export function spanStyle(
  colSpan: number,
  rowSpan: number
): React.CSSProperties {
  const c = Math.min(MAX_SPAN, Math.max(1, Math.round(colSpan)));
  const r = Math.min(MAX_SPAN, Math.max(1, Math.round(rowSpan)));
  return {
    gridColumn: `span ${c} / span ${c}`,
    gridRow: `span ${r} / span ${r}`,
  };
}

/** Kept as an empty-class helper so old call sites that interpolate
 *  `${spanClass(...)}` into a className string keep working without
 *  changes. New code should switch to `spanStyle`. */
export function spanClass(_colSpan: number, _rowSpan: number): string {
  return "";
}
