"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

type Props = {
  /** Markdown slug to append uploads to (e.g. "human"). */
  slug: string;
};

type DragPreview = {
  count: number;
  /** "image", "video", "mixed", or null when we can't tell from items alone. */
  kind: "image" | "video" | "mixed" | null;
};

type Toast = {
  id: number;
  tone: "info" | "success" | "error";
  message: string;
};

const TOAST_DEFAULT_MS = 2500;
const TOAST_LONG_MS = 4000;

/**
 * Owner-only drop target that covers the homepage. Drag images or videos
 * anywhere; each one uploads to R2 and the markdown body for `slug` gets a
 * new `![](url)` line appended. The page is then refreshed so the new media
 * renders in place.
 *
 * Visuals:
 *   • Full-window dimmed scrim with a pulsing dashed border while a drag is
 *     in progress, so the affordance reads from anywhere on the page.
 *   • A center card shows an upload icon, the file count, and what kind of
 *     media is being dropped (image / video / mixed).
 *   • A bottom-center toast surfaces upload progress and result state with
 *     a colored leading icon (info / success / error).
 */
export function HomeDropzone({ slug }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // dragenter/dragleave fire for every nested element, so we track depth
  // to avoid flicker.
  const dragDepth = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (tone: Toast["tone"], message: string, ms = TOAST_DEFAULT_MS) => {
    const id = Date.now();
    setToast({ id, tone, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const hasFiles = (e: DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const describeItems = (items: DataTransferItemList | undefined): DragPreview => {
    if (!items || items.length === 0) return { count: 0, kind: null };
    let images = 0;
    let videos = 0;
    let other = 0;
    for (const item of items) {
      if (item.kind !== "file") continue;
      if (item.type.startsWith("image/")) images += 1;
      else if (item.type.startsWith("video/")) videos += 1;
      else other += 1;
    }
    const count = images + videos + other;
    if (count === 0) return { count: 0, kind: null };
    if (images > 0 && videos === 0 && other === 0) return { count, kind: "image" };
    if (videos > 0 && images === 0 && other === 0) return { count, kind: "video" };
    return { count, kind: "mixed" };
  };

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setPreview(describeItems(e.dataTransfer?.items));
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setPreview(null);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setPreview(null);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      await handleFiles(files);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleFiles = async (files: File[]) => {
    const total = files.length;
    showToast(
      "info",
      total === 1 ? "Uploading 1 file…" : `Uploading 0 of ${total}…`,
      60_000
    );

    const urls: string[] = [];
    let firstFailure: string | null = null;
    let done = 0;

    await Promise.all(
      files.map(async (file) => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? `upload failed (${res.status})`);
          }
          const data = (await res.json()) as { url: string };
          urls.push(data.url);
        } catch (err) {
          firstFailure =
            firstFailure ?? (err instanceof Error ? err.message : "upload failed");
        } finally {
          done += 1;
          if (total > 1) {
            showToast("info", `Uploading ${done} of ${total}…`, 60_000);
          }
        }
      })
    );

    if (urls.length === 0) {
      showToast("error", firstFailure ?? "Upload failed", TOAST_LONG_MS);
      return;
    }

    // Append each uploaded URL as a markdown image line. The renderer
    // detects video extensions and swaps in a `<video>` element so the same
    // `![](url)` token covers both cases.
    const appended = urls.map((url) => `![](${url})`).join("\n\n");
    try {
      const current = await fetch(`/api/pages/${slug}`).then((r) =>
        r.ok ? r.json().then((d: { body: string }) => d.body) : ""
      );
      const nextBody = `${(current ?? "").replace(/\s+$/, "")}\n\n${appended}\n`;
      const save = await fetch(`/api/pages/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: nextBody }),
      });
      if (!save.ok) throw new Error(`save failed (${save.status})`);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "save failed",
        TOAST_LONG_MS
      );
      return;
    }

    const ok = urls.length;
    showToast(
      firstFailure ? "error" : "success",
      firstFailure
        ? `Added ${ok}/${total} — ${firstFailure}`
        : `Added ${ok} ${ok === 1 ? "file" : "files"}`,
      firstFailure ? TOAST_LONG_MS : TOAST_DEFAULT_MS
    );
    router.refresh();
  };

  return (
    <>
      <AnimatePresence>
        {preview && <DragOverlay preview={preview} />}
      </AnimatePresence>
      <AnimatePresence>{toast && <ToastBubble toast={toast} />}</AnimatePresence>
    </>
  );
}

function DragOverlay({ preview }: { preview: DragPreview }) {
  const label = formatPreviewLabel(preview);
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Dim scrim — full window */}
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-[3px]" />
      {/* Animated dashed frame — sits inside the safe-area padding */}
      <motion.div
        className="absolute inset-3 rounded-[10px] border-2 border-dashed border-fg/60"
        initial={{ scale: 0.995, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* Centered card */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex w-full max-w-[320px] flex-col items-center gap-3 rounded-[10px] border border-border bg-content px-6 py-7 text-center shadow-[0_24px_64px_-16px_rgb(0_0_0_/_0.5)]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-hover text-fg">
          <UploadSimple size={22} weight="bold" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-medium text-fg">Drop to upload</p>
          <p className="text-[12px] text-muted">{label}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ToastBubble({ toast }: { toast: Toast }) {
  const Icon =
    toast.tone === "success"
      ? CheckCircle
      : toast.tone === "error"
        ? WarningCircle
        : UploadSimple;
  const iconColor =
    toast.tone === "success"
      ? "text-emerald-400"
      : toast.tone === "error"
        ? "text-rose-400"
        : "text-fg";
  return (
    <motion.div
      key={toast.id}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-[8px] border border-border bg-content/95 py-2 pr-3 pl-2.5 text-[12.5px] text-fg shadow-[0_12px_32px_-12px_rgb(0_0_0_/_0.5)] backdrop-blur"
    >
      <Icon
        size={16}
        weight={toast.tone === "info" ? "bold" : "fill"}
        className={iconColor}
        aria-hidden
      />
      <span>{toast.message}</span>
    </motion.div>
  );
}

function formatPreviewLabel(preview: DragPreview): string {
  const { count, kind } = preview;
  if (count <= 0) {
    return "Release to upload images or videos";
  }
  const noun =
    kind === "image"
      ? count === 1
        ? "image"
        : "images"
      : kind === "video"
        ? count === 1
          ? "video"
          : "videos"
        : count === 1
          ? "file"
          : "files";
  return `${count} ${noun} ready`;
}
