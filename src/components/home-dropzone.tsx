"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  /** Markdown slug to append uploads to (e.g. "human"). */
  slug: string;
};

/**
 * Owner-only drop target that covers the homepage. Drag images or videos
 * anywhere on the page; each one uploads to R2 and the markdown body for
 * `slug` gets a new `![](url)` line appended. The page is then refreshed so
 * the new media renders in-place. Designed to feel like the page itself
 * accepts files — no edit-mode toggle, no toolbar.
 *
 * Renders nothing visible until a drag enters the window.
 */
export function HomeDropzone({ slug }: Props) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // dragenter/dragleave fire for every child node, so we count depth to
  // avoid flicker when the cursor passes between elements.
  const dragDepth = useRef(0);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  const flash = (msg: string, ms = 2500) => {
    setStatus(msg);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), ms);
  };

  const hasFiles = (e: DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
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
      setDragging(false);
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
    // handleFiles closes over `slug` + `router` which are stable on first
    // render, so re-binding only when those change is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleFiles = async (files: File[]) => {
    flash(
      files.length === 1 ? "Uploading 1 file…" : `Uploading ${files.length} files…`,
      60_000
    );
    const urls: string[] = [];
    let failMsg: string | null = null;

    await Promise.all(
      files.map(async (file) => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(data.error ?? `upload failed (${res.status})`);
          }
          const data = (await res.json()) as { url: string };
          urls.push(data.url);
        } catch (err) {
          failMsg = failMsg ?? (err instanceof Error ? err.message : "upload failed");
        }
      })
    );

    if (urls.length === 0) {
      flash(failMsg ?? "Upload failed", 4000);
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
      flash(err instanceof Error ? err.message : "save failed", 4000);
      return;
    }

    flash(
      failMsg
        ? `Added ${urls.length}/${files.length} — ${failMsg}`
        : `Added ${urls.length} ${urls.length === 1 ? "file" : "files"}`
    );
    router.refresh();
  };

  return (
    <>
      {dragging && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-2 z-50 flex items-center justify-center rounded-[6px] border-2 border-dashed border-fg/40 bg-content/70 backdrop-blur-sm"
        >
          <div className="rounded-[4px] border border-border-soft bg-content px-3 py-1.5 text-[12px] text-fg shadow-sm">
            Drop to upload
          </div>
        </div>
      )}
      {status && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[4px] border border-border-soft bg-content/95 px-3 py-1.5 text-[12px] text-fg shadow-sm"
        >
          {status}
        </div>
      )}
    </>
  );
}
