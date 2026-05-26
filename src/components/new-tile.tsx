"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { MEDIA_ACCEPT } from "@/lib/media";

type Props = {
  /** Group ID the new tile should land in. Required so uploads scope to
   *  the section that surfaced this tile. */
  groupId: string;
};

/**
 * Owner-only "add" tile that sits at the end of each section's grid.
 *  • Click "Upload" — opens the file picker, every chosen file becomes a
 *    new tile in this section with the file as its hero.
 *  • Drop a file onto this tile — same outcome with a visible highlight
 *    while a drag is over it.
 *  • Click "New" — creates an empty Untitled tile and routes to its editor.
 */
export function NewTile({ groupId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const uploadAndCreate = async (files: File[]) => {
    setBusy(true);
    try {
      for (const file of files) {
        // For videos: extract a first-frame poster on the client so iOS
        // Safari has something to show without autoplay. Best-effort — if
        // extraction fails, we proceed without a poster.
        let posterUrl: string | undefined;
        if (file.type.startsWith("video/")) {
          const poster = await extractVideoPoster(file).catch(() => null);
          if (poster) {
            const posterFd = new FormData();
            posterFd.append("file", poster);
            const posterRes = await fetch("/api/upload", {
              method: "POST",
              body: posterFd,
            });
            if (posterRes.ok) {
              const data = (await posterRes.json()) as { url: string };
              posterUrl = data.url;
            }
          }
        }

        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (!up.ok) {
          const data = (await up.json().catch(() => ({}))) as { error?: string };
          alert(data.error ?? `upload failed (${up.status})`);
          continue;
        }
        const { url } = (await up.json()) as { url: string };
        const proj = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Untitled",
            heroImageUrl: url,
            posterUrl,
            groupId,
          }),
        });
        if (!proj.ok) {
          const data = (await proj.json().catch(() => ({}))) as { error?: string };
          alert(data.error ?? `couldn't create tile (${proj.status})`);
        }
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Pull a still from the file's first decodable frame using an offscreen
   * <video> + canvas. Returns a JPEG File that can be uploaded via the same
   * /api/upload route as the original video. Resolves to null if the
   * browser refuses to seek / decode (e.g. unsupported codec).
   */
  const extractVideoPoster = async (file: File): Promise<File | null> => {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      video.src = objectUrl;

      const cleanup = () => URL.revokeObjectURL(objectUrl);

      let seeked = false;
      video.onloadeddata = () => {
        // Seek a touch off zero to avoid a black leading frame on some
        // codecs. iOS Safari needs an explicit seek to decode a frame.
        try {
          video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
        } catch {
          cleanup();
          resolve(null);
        }
      };
      video.onseeked = () => {
        if (seeked) return;
        seeked = true;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          cleanup();
          resolve(null);
          return;
        }
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) return resolve(null);
            const base = file.name.replace(/\.[^.]+$/, "");
            resolve(
              new File([blob], `${base}.poster.jpg`, { type: "image/jpeg" })
            );
          },
          "image/jpeg",
          0.85
        );
      };
      video.onerror = () => {
        cleanup();
        resolve(null);
      };
    });
  };

  const createBlank = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Untitled project", groupId }),
      });
      if (!res.ok) return;
      const project = (await res.json()) as { id: string };
      router.push(`/edit/${project.id}`);
    } finally {
      setBusy(false);
    }
  };

  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) void uploadAndCreate(files);
      }}
      className="group/wrapper relative h-full"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void uploadAndCreate(files);
          e.target.value = "";
        }}
        className="hidden"
      />
      <div
        className={
          "double-stroke flex h-full min-h-[180px] flex-col overflow-hidden rounded-[8px] bg-hover transition-colors " +
          (dragOver ? "ring-2 ring-fg/60 ring-offset-2 ring-offset-bg" : "")
        }
      >
        <div className="relative z-[1] flex flex-1 flex-col gap-2 p-1">
          <div
            className={
              "flex aspect-[16/10] flex-1 flex-col items-center justify-center gap-2 rounded-[6px] border border-dashed transition-colors " +
              (dragOver
                ? "border-fg bg-fg/[0.06] text-fg"
                : "border-border bg-hover text-muted")
            }
          >
            <UploadSimple
              size={20}
              weight={dragOver ? "fill" : "bold"}
              aria-hidden
            />
            <p className="text-[12.5px]">
              {busy
                ? "Uploading…"
                : dragOver
                  ? "Drop to add tile"
                  : "Drop files or click to upload"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/80 px-2 py-1 text-[11px] text-fg hover:bg-content disabled:opacity-50"
              >
                <UploadSimple size={11} weight="bold" aria-hidden />
                Upload
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  void createBlank();
                }}
                className="inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/40 px-2 py-1 text-[11px] text-muted hover:text-fg disabled:opacity-50"
              >
                <Plus size={11} weight="bold" aria-hidden />
                New
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
