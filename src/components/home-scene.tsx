"use client";

import { useEffect, useRef, useState } from "react";
import UnicornScene from "unicornstudio-react";

const PROJECT_ID = "KsvQdy6ql75m1zkNeq6r";
const SDK_URL =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.12/dist/unicornStudio.umd.js";

/**
 * Client wrapper around UnicornScene. The underlying component wants
 * explicit pixel dimensions, so we measure our container with a
 * ResizeObserver and feed the current size in. Re-renders on viewport
 * resize keep the scene crisp without needing a hard reload.
 *
 * Skipped entirely while measuring (size = 0) and on viewports narrower
 * than the md breakpoint — keeps the markdown column readable on phones
 * and avoids loading the WebGL scene where there's no space for it.
 */
export function HomeScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-[420px] w-full overflow-hidden rounded-[8px] lg:h-[520px]"
      aria-hidden
    >
      {size && size.w > 0 && size.h > 0 ? (
        <UnicornScene
          projectId={PROJECT_ID}
          width={`${size.w}px`}
          height={`${size.h}px`}
          // Scene content rendered at half size inside the canvas.
          scale={0.5}
          dpi={1.5}
          sdkUrl={SDK_URL}
        />
      ) : null}
    </div>
  );
}
