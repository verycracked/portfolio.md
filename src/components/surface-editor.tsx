"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "@phosphor-icons/react/dist/ssr";
import { EditableText } from "@/components/editable-text";
import { MEDIA_ACCEPT, isVideoUrl } from "@/lib/media";
import {
  uploadFile,
  saveSurface,
  addSurfaceImage,
  removeSurfaceImage,
} from "@/components/project-form-helpers";

export type SurfaceImage = {
  id: string;
  url: string;
  caption: string | null;
};

export type Surface = {
  id: string;
  slug: string;
  name: string;
  description: string;
  body: string;
  heroImageUrl: string | null;
  order: number;
  images: SurfaceImage[];
};

type Props = {
  projectId: string;
  projectSlug: string;
  surface: Surface;
  /** Patch a field on this surface in parent state. */
  onPatch: (patch: Partial<Surface>) => void;
  /** Replace the images array on this surface. */
  onImagesChange: (
    update: (prev: SurfaceImage[]) => SurfaceImage[]
  ) => void;
  /** Wraps every server write so the parent form can drive a shared
   *  "Saving… / Saved" indicator. Identity-passes the promise so
   *  callers' awaits / error handling stay intact. */
  trackSave?: <T>(p: Promise<T>) => Promise<T>;
};

/**
 * Per-surface editor: hero (image or video), markdown body, gallery.
 * Owned mutations of the parent surface go through `onPatch`/`onImagesChange`
 * so the parent stays the single source of truth for the surfaces list.
 */
export function SurfaceEditor({
  projectId,
  projectSlug,
  surface,
  onPatch,
  onImagesChange,
  trackSave,
}: Props) {
  // Wrap-or-passthrough: when the parent didn't supply a tracker we
  // still return the promise unchanged, so the editor stays usable in
  // isolation (e.g. tests / Storybook).
  const track = <T,>(p: Promise<T>): Promise<T> =>
    trackSave ? trackSave(p) : p;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  const debouncedSave = (patch: Partial<Surface>) => {
    onPatch(patch);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void track(saveSurface(projectId, surface.id, patch));
    }, 600);
  };

  const immediateSave = (patch: Partial<Surface>) => {
    onPatch(patch);
    void track(saveSurface(projectId, surface.id, patch));
  };

  const uploadHero = async (file: File) => {
    setUploadError(null);
    try {
      const url = await track(uploadFile(file, projectSlug));
      immediateSave({ heroImageUrl: url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "upload failed");
    }
  };

  const addGalleryFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadError(null);
    const uploads = await Promise.allSettled(
      files.map((f) => track(uploadFile(f, projectSlug)))
    );
    const firstFailure = uploads.find((r) => r.status === "rejected");
    if (firstFailure && firstFailure.status === "rejected") {
      const reason = firstFailure.reason;
      setUploadError(reason instanceof Error ? reason.message : "upload failed");
    }
    for (const result of uploads) {
      if (result.status !== "fulfilled") continue;
      const image = await track(
        addSurfaceImage(projectId, surface.id, result.value)
      );
      if (image) onImagesChange((prev) => [...prev, image]);
    }
  };

  const removeImage = async (imageId: string) => {
    const ok = await track(removeSurfaceImage(projectId, imageId));
    if (ok) {
      onImagesChange((prev) => prev.filter((i) => i.id !== imageId));
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Hero — hidden controls until hover */}
      <div className="group relative">
        <div className="aspect-[16/10] overflow-hidden rounded-[6px] border border-border bg-hover">
          {surface.heroImageUrl ? (
            isVideoUrl(surface.heroImageUrl) ? (
              <video
                src={surface.heroImageUrl}
                className="h-full w-full object-cover"
                muted
                loop
                playsInline
                autoPlay
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={surface.heroImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <button
              type="button"
              onClick={() => heroInputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-tertiary transition-colors hover:text-fg"
            >
              <ImageIcon size={32} weight="fill" aria-hidden />
              <span className="text-[12px]">Add hero image or video</span>
            </button>
          )}
        </div>
        {surface.heroImageUrl && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => heroInputRef.current?.click()}
              className="rounded-[4px] border border-border-soft bg-content/95 px-2 py-1 text-[11px] text-fg"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => immediateSave({ heroImageUrl: null })}
              className="rounded-[4px] border border-border-soft bg-content/95 px-2 py-1 text-[11px] text-muted hover:text-fg"
            >
              Remove
            </button>
          </div>
        )}
        <input
          ref={heroInputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadHero(f);
            e.target.value = "";
          }}
          className="hidden"
        />
        {uploadError && (
          <p
            role="alert"
            className="mt-2 flex items-start justify-between gap-3 rounded-[4px] border border-border-soft bg-hover px-2.5 py-1.5 text-[11px] text-muted"
          >
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-tertiary hover:text-fg"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </p>
        )}
      </div>

      {/* Description — short blurb shown right under the surface name
          on the public detail page. Distinct from `body` (long form). */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-[0.06em] text-tertiary">
          Description
        </label>
        <EditableText
          value={surface.description}
          onChange={(v) => debouncedSave({ description: v })}
          placeholder="Short blurb under the title (one or two sentences)"
          multiline
          plainText
          as="div"
          className="min-h-[2.5rem] text-[14px] leading-[1.55] text-fg"
        />
      </div>

      {/* Body */}
      <article className="prose max-w-none">
        <EditableText
          value={surface.body}
          onChange={(v) => debouncedSave({ body: v })}
          placeholder="Longer write-up. Markdown works: **bold**, ## headings, - lists"
          multiline
          plainText
          as="div"
          className="min-h-[6rem] text-[13px] leading-[1.65] text-fg"
        />
      </article>

      {/* Gallery */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] text-muted">More media</h3>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            + Add images or videos
          </button>
        </div>
        <input
          ref={galleryInputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) void addGalleryFiles(files);
            e.target.value = "";
          }}
          className="hidden"
        />
        {surface.images.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {surface.images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-[16/10] overflow-hidden rounded-[6px] border border-border bg-hover"
              >
                {isVideoUrl(img.url) ? (
                  <video
                    src={img.url}
                    className="h-full w-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt={img.caption ?? ""}
                    className="h-full w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => void removeImage(img.id)}
                  className="absolute right-1 top-1 rounded-[4px] border border-border-soft bg-content/95 px-2 py-0.5 text-[10px] text-muted opacity-0 group-hover:opacity-100 hover:text-fg"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
