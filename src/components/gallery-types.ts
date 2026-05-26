export type GalleryProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string | null;
  isProtected: boolean;
  /** 1–4 — number of grid columns this card occupies horizontally. */
  colSpan: number;
  /** 1–2 — number of grid rows this card occupies vertically. */
  rowSpan: number;
};

// Static class maps so Tailwind's JIT can see the literal class names.
// Dynamic interpolation (`col-span-${n}`) wouldn't be picked up.
const COL_SPAN_CLASS: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
};
const ROW_SPAN_CLASS: Record<number, string> = {
  1: "sm:row-span-1",
  2: "sm:row-span-2",
};

export function spanClass(colSpan: number, rowSpan: number): string {
  const c = COL_SPAN_CLASS[Math.min(2, Math.max(1, colSpan))] ?? COL_SPAN_CLASS[1];
  const r = ROW_SPAN_CLASS[Math.min(2, Math.max(1, rowSpan))] ?? ROW_SPAN_CLASS[1];
  return `${c} ${r}`;
}
