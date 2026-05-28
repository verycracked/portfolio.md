"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon } from "@phosphor-icons/react/dist/ssr";
import { uploadMedia } from "@/lib/media-utils";
import { MEDIA_ACCEPT, isVideoUrl } from "@/lib/media";

type Props = {
  projectId: string;
  surfaceId: string;
  initialHeroImageUrl: string | null;
  alt: string;
  /** True when the visitor is the site owner and NOT previewing — only
   *  then do we expose the upload placeholder / replace controls. */
  owner: boolean;
};

/**
 * Surface page hero. When the surface has its own cover, renders it in
 * the same 16:10 frame the rest of the site uses. When it doesn't:
 *   • owner sees a click-to-upload placeholder so the slot is reachable
 *     without bouncing to the editor
 *   • visitors see nothing at all (we used to fall back to the project
 *     hero, but that read as a duplicate of the Overview tab)
 *
 * On upload, persists via PUT and refreshes the server data so the new
 * hero appears immediately.
 */
export function SurfaceHeroSlot({
  projectId,
  surfaceId,
  initialHeroImageUrl,
  alt,
  owner,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hero, setHero] = useState<string | null>(initialHeroImageUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadMedia(file);
      if (!uploaded) throw new Error("upload failed");
      const res = await fetch(`/api/projects/${projectId}/surfaces/${surfaceId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heroImageUrl: uploaded.url }),
      });
      if (!res.ok) throw new Error("save failed");
      setHero(uploaded.url);
      // Re-fetch the server component so any descendant reads of the
      // surface (e.g. the gallery list) pick up the new URL too.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  if (hero) {
    return (
      <div className="relative aspect-[16/10] overflow-hidden rounded-[6px] border border-border bg-hover">
        {isVideoUrl(hero) ? (
          <video
            src={hero}
            aria-label={alt}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={hero} alt={alt} className="h-full w-full object-cover" />
        )}
        {owner && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="absolute right-2 top-2 rounded-[4px] border border-border-soft bg-content/95 px-2 py-1 text-[11px] text-fg opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
          >
            {busy ? "Uploading…" : "Replace"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>
    );
  }

  if (!owner) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed border-border bg-hover/40 text-tertiary transition-colors hover:border-border-soft hover:bg-hover hover:text-fg"
      >
        <ImageIcon size={32} weight="fill" aria-hidden />
        <span className="text-[12px]">
          {busy ? "Uploading…" : "Add hero image or video"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
        className="hidden"
      />
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-[4px] border border-border-soft bg-hover px-2.5 py-1.5 text-[11px] text-muted"
        >
          {error}
        </p>
      )}
    </div>
  );
}
