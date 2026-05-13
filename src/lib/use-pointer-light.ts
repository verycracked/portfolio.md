"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Pointer-driven "physical button" physics for a card.
 *
 * Writes two unitless CSS custom properties (`--mx`, `--my`, range 0-100) on
 * the target element. CSS consumes them for:
 *   • the stroke-light gradient (placed opposite the cursor — far edge
 *     catches more light when you press the near edge), and
 *   • a subtle 3D tilt (the pressed edge rotates away from the camera).
 *
 * Lifecycle:
 *   • pointerenter → adds `.is-pressed` (enables the 3D tilt rule)
 *   • pointermove  → updates `--mx`, `--my` instantly (no transition lag)
 *   • pointerleave → removes `.is-pressed` (tilt eases back to flat via
 *                    CSS transition on transform) AND eases `--mx`/`--my`
 *                    back to rest (50, 120) over ~420ms with easeOutQuart
 *                    so the stroke highlight settles to a top-lit default.
 */
const REST = { x: 50, y: 120 };
const LEAVE_DURATION = 420;

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

export function usePointerLight() {
  const last = useRef({ ...REST });
  const rafId = useRef<number | null>(null);

  const cancelRaf = () => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  return {
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => {
      cancelRaf();
      e.currentTarget.classList.add("is-pressed");
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      cancelRaf();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      last.current = { x, y };
      e.currentTarget.style.setProperty("--mx", `${x}`);
      e.currentTarget.style.setProperty("--my", `${y}`);
    },
    onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => {
      e.currentTarget.classList.remove("is-pressed");
      cancelRaf();
      const el = e.currentTarget;
      const from = { ...last.current };
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / LEAVE_DURATION);
        const k = easeOutQuart(t);
        const x = from.x + (REST.x - from.x) * k;
        const y = from.y + (REST.y - from.y) * k;
        el.style.setProperty("--mx", `${x}`);
        el.style.setProperty("--my", `${y}`);
        if (t < 1) {
          rafId.current = requestAnimationFrame(tick);
        } else {
          rafId.current = null;
          last.current = { ...REST };
        }
      };
      rafId.current = requestAnimationFrame(tick);
    },
  };
}
