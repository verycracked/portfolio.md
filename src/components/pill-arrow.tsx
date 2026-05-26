import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

/**
 * The ↗ icon used inside every nomo pill.
 *
 * Renders TWO arrows stacked at the same spot:
 *   • `.nomo-pill-arrow-rest`  — the one you see at rest. On hover it
 *     translates up-and-right and fades to 0.
 *   • `.nomo-pill-arrow-hover` — starts translated down-and-left + invisible.
 *     On hover it eases to (0,0) at opacity 1.
 *
 * Both arrows transition the same properties with the same easing, so a
 * mid-hover mouse-out smoothly reverses each arrow back to its rest state
 * from wherever it currently is — no snap. (CSS keyframe animations can't
 * do this; removing the animation rule mid-flight snaps to the base style.)
 */
export function PillArrow() {
  return (
    <span
      aria-hidden
      className="nomo-pill-arrow-wrap relative inline-block align-middle"
      style={{ width: 11, height: 11 }}
    >
      <ArrowUpRight
        weight="bold"
        size={11}
        className="nomo-pill-arrow-rest absolute inset-0 text-tertiary"
      />
      <ArrowUpRight
        weight="bold"
        size={11}
        className="nomo-pill-arrow-hover absolute inset-0 text-tertiary"
      />
    </span>
  );
}
