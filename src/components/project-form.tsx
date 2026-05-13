"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Image as ImageIcon } from "@phosphor-icons/react/dist/ssr";
import { EditableText } from "@/components/editable-text";

type ProjectImage = {
  id: string;
  url: string;
  caption: string | null;
};

type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  heroImageUrl: string | null;
  sourceUrl: string | null;
  isProtected: boolean;
  images: ProjectImage[];
};

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload failed");
  const data = (await res.json()) as { url: string };
  return data.url;
}

async function captureUrl(url: string): Promise<string> {
  const res = await fetch("/api/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "capture failed");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

function ProtectionControl({
  projectId,
  isProtected,
  onChange,
}: {
  projectId: string;
  isProtected: boolean;
  onChange: (isProtected: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (raw: string | null) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: raw }),
      });
      if (res.ok) {
        onChange(!!raw);
        setOpen(false);
        setPassword("");
      }
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setPassword("");
  };

  return (
    <div className="relative flex items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted underline-offset-2 hover:text-fg hover:underline"
      >
        {isProtected ? "Change password" : "Add password"}
      </button>
      {isProtected && (
        <button
          type="button"
          onClick={() => save(null)}
          disabled={busy}
          className="text-tertiary underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
        >
          Make public
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            {/* Curtain — full-screen backdrop, clicking closes */}
            <motion.button
              type="button"
              aria-label="Close"
              onClick={close}
              className="fixed inset-0 z-40 bg-fg/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.25, 1, 0.5, 1] }}
            />

            {/* Popover anchored under the trigger */}
            <motion.div
              className="absolute left-0 top-full z-50 mt-2 w-[260px] origin-top-left rounded-[8px] border border-border-soft bg-content/80 p-3 shadow-lg backdrop-blur-md"
              role="dialog"
              aria-label="Set project password"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -2, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="mb-2 text-[11px] text-tertiary">
                {isProtected
                  ? "Change the password visitors need to view this project."
                  : "Visitors will need this password to view this project."}
              </p>
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(password);
                  if (e.key === "Escape") close();
                }}
                placeholder="New password"
                className="w-full rounded-[6px] border border-border bg-content px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-tertiary focus:border-fg"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="text-[12px] text-tertiary underline-offset-2 hover:text-fg hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => save(password)}
                  disabled={busy || !password}
                  className="rounded-[6px] bg-fg px-3 py-1 text-[12px] font-medium text-content disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProjectForm({ project: initial }: { project: Project }) {
  const router = useRouter();
  const [project, setProject] = useState(initial);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const save = async (patch: Partial<Project>) => {
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // silent
    }
  };

  const debouncedSave = (patch: Partial<Project>) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => save(patch), 600);
  };

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const update = (patch: Partial<Project>, immediate = false) => {
    setProject((p) => ({ ...p, ...patch }));
    (immediate ? save : debouncedSave)(patch);
  };

  const capture = async () => {
    if (!project.sourceUrl) return;
    setCaptureError(null);
    setCapturing(true);
    try {
      const url = await captureUrl(project.sourceUrl);
      update({ heroImageUrl: url }, true);
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "capture failed");
    } finally {
      setCapturing(false);
    }
  };

  const uploadHero = async (file: File) => {
    try {
      const url = await uploadFile(file);
      update({ heroImageUrl: url }, true);
    } catch {
      // silent
    }
  };

  const addGalleryImage = async (file: File) => {
    try {
      const url = await uploadFile(file);
      const res = await fetch(`/api/projects/${project.id}/images`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) return;
      const image = (await res.json()) as ProjectImage;
      setProject((p) => ({ ...p, images: [...p.images, image] }));
    } catch {
      // silent
    }
  };

  const removeGalleryImage = async (imageId: string) => {
    const res = await fetch(
      `/api/projects/${project.id}/images?imageId=${imageId}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    setProject((p) => ({ ...p, images: p.images.filter((i) => i.id !== imageId) }));
  };

  const deleteProject = async () => {
    if (!confirm(`delete "${project.title}"? this cannot be undone.`)) return;
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Status row */}
      <div
        className="animate-fade-in flex flex-wrap items-center justify-end gap-3 text-[12px]"
        style={{ ["--reveal-delay" as string]: "40ms" }}
      >
        <div className="flex items-center gap-4">
          <ProtectionControl
            projectId={project.id}
            isProtected={project.isProtected}
            onChange={(isProtected) =>
              setProject((p) => ({ ...p, isProtected }))
            }
          />
          <button
            type="button"
            onClick={deleteProject}
            className="text-tertiary underline-offset-2 hover:text-fg hover:underline"
          >
            Delete project
          </button>
        </div>
      </div>

      {/* Title + description, edit in place — looks like the published page */}
      <header
        className="animate-fade-rise flex flex-col gap-2"
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <EditableText
          value={project.title}
          onChange={(v) => update({ title: v })}
          placeholder="Untitled project"
          as="h1"
          className="text-[20px] font-semibold tracking-[-0.018em] text-fg"
        />
        <EditableText
          value={project.description}
          onChange={(v) => update({ description: v })}
          placeholder="Short description, one line is fine"
          multiline
          as="p"
          className="text-[14px] text-muted"
        />
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px]">
          <span className="text-tertiary">↗</span>
          <EditableText
            value={project.sourceUrl ?? ""}
            onChange={(v) => update({ sourceUrl: v || null })}
            placeholder="https://example.com"
            as="span"
            className="text-muted"
          />
          {project.sourceUrl && (
            <button
              type="button"
              onClick={capture}
              disabled={capturing}
              className="text-tertiary underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
            >
              {capturing ? "Capturing…" : "Capture hero"}
            </button>
          )}
        </div>
        {captureError && (
          <span className="text-[12px] text-muted">{captureError}</span>
        )}
      </header>

      {/* Hero image — hoverable, hidden controls until hover */}
      <div
        className="animate-fade-rise group relative"
        style={{ ["--reveal-delay" as string]: "160ms" }}
      >
        <div className="aspect-[16/10] overflow-hidden rounded-[6px] border border-border bg-hover">
          {project.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.heroImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <button
              type="button"
              onClick={() => heroInputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-tertiary transition-colors hover:text-fg"
            >
              <ImageIcon size={32} weight="fill" aria-hidden />
              <span className="text-[12px]">Add hero image</span>
            </button>
          )}
        </div>
        {project.heroImageUrl && (
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
              onClick={() => update({ heroImageUrl: null }, true)}
              className="rounded-[4px] border border-border-soft bg-content/95 px-2 py-1 text-[11px] text-muted hover:text-fg"
            >
              Remove
            </button>
          </div>
        )}
        <input
          ref={heroInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadHero(f);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* Body — edit in place, prose-styled */}
      <article
        className="animate-fade-rise prose max-w-none"
        style={{ ["--reveal-delay" as string]: "240ms" }}
      >
        <EditableText
          value={project.body}
          onChange={(v) => update({ body: v })}
          placeholder="Longer write-up. Markdown works: **bold**, ## headings, - lists"
          multiline
          plainText
          as="div"
          className="min-h-[6rem] text-[13px] leading-[1.65] text-fg"
        />
      </article>

      {/* Gallery */}
      <div
        className="animate-fade-rise flex flex-col gap-3"
        style={{ ["--reveal-delay" as string]: "320ms" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] text-muted">More images</h3>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            + Add image
          </button>
        </div>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addGalleryImage(f);
            e.target.value = "";
          }}
          className="hidden"
        />
        {project.images.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {project.images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-[16/10] overflow-hidden rounded-[6px] border border-border bg-hover"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption ?? ""}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeGalleryImage(img.id)}
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
