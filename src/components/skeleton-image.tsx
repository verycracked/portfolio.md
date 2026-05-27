"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = Omit<ImageProps, "onLoad"> & {
  /** Extra classes for the wrapper that hosts the skeleton. Use this to
   *  set sizing when not using `fill` mode. */
  wrapperClassName?: string;
  /** When false, skips the skeleton entirely. Useful for tiny avatars. */
  showSkeleton?: boolean;
};

/**
 * Drop-in replacement for `<Image>` that crossfades from a shimmering
 * skeleton to the decoded photo.
 *
 *  • Cached-image-safe — if the underlying <img> finished decoding before
 *    React's onLoad listener attached, we probe `img.complete` in an
 *    effect and flip the load state immediately. Prevents the skeleton
 *    from getting stuck on top of an already-painted image.
 *  • Sized via the wrapper — the wrapper is a `<div>` with `relative
 *    h-full w-full` by default so `<Image fill>` always sees a parent
 *    with a real bounding box (Next/Image emits a "height of 0" warning
 *    if its immediate parent collapses, which is what happened when the
 *    wrapper was a `<span>` with `display: block` + `position: absolute`).
 *
 * Pair with a sized parent — pass `fill` on the Image and let the parent
 * (e.g. an `aspect-[16/10]` or `size-16` container) drive the dimensions.
 */
export function SkeletonImage({
  wrapperClassName = "",
  showSkeleton = true,
  className = "",
  // UI screenshots take a real hit at the default quality of 75 — bump
  // to 92 so the transcoded webp/avif stays sharp. Callers can override
  // for cases where bandwidth matters more than detail.
  quality = 92,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className={`relative h-full w-full ${wrapperClassName}`}>
      {showSkeleton && (
        <div
          aria-hidden
          className={
            "skeleton-shimmer absolute inset-0 transition-opacity duration-500 " +
            (loaded ? "pointer-events-none opacity-0" : "opacity-100")
          }
        />
      )}
      <Image
        {...rest}
        quality={quality}
        ref={imgRef}
        data-loaded={loaded ? "true" : "false"}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`media-fade ${className}`}
      />
    </div>
  );
}
