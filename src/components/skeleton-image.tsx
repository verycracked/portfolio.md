"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = Omit<ImageProps, "onLoad"> & {
  /** Optional extra classes for the wrapper that hosts the skeleton. */
  wrapperClassName?: string;
  /** When false, skips the skeleton entirely (renders the bare image).
   *  Useful for tiny avatars where the placeholder is more noise than
   *  signal. Defaults to true. */
  showSkeleton?: boolean;
};

/**
 * Drop-in replacement for `<Image>` that crossfades from a shimmering
 * skeleton to the decoded photo. Handles the cached-image edge case
 * (browser flips `img.complete = true` before React's `onLoad` attaches),
 * so the fade-in never gets stuck on a hidden image.
 *
 * Wrapper is `position: relative` so it can host the absolute skeleton —
 * pass `fill` on the underlying Image and a sized wrapper via
 * `wrapperClassName` (e.g. `aspect-[16/10]` or a fixed h/w).
 */
export function SkeletonImage({
  wrapperClassName = "",
  showSkeleton = true,
  className = "",
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Cached-image catch: if the underlying <img> finished decoding before
  // React's listener attached, no `onLoad` is fired and we'd otherwise
  // keep the skeleton up indefinitely.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <span className={`relative block ${wrapperClassName}`}>
      {showSkeleton && (
        <span
          aria-hidden
          className={
            "skeleton-shimmer absolute inset-0 transition-opacity duration-500 " +
            (loaded ? "pointer-events-none opacity-0" : "opacity-100")
          }
        />
      )}
      <Image
        {...rest}
        ref={imgRef}
        data-loaded={loaded ? "true" : "false"}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`media-fade ${className}`}
      />
    </span>
  );
}
