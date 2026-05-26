"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { slugify } from "@/lib/slug";
import { EditableText } from "@/components/editable-text";
import { ProjectProtectionControl } from "@/components/project-protection-control";
import { SurfaceTabBarEditor } from "@/components/surface-tab-bar-editor";
import { SurfaceEditor, type Surface, type SurfaceImage } from "@/components/surface-editor";
import {
  captureUrl,
  createSurface,
  deleteSurface,
  saveProject,
  saveSurface,
} from "@/components/project-form-helpers";

type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  sourceUrl: string | null;
  isProtected: boolean;
  /** Bento-grid sizing on /portfolio — 1..4 cols, 1..2 rows. */
  colSpan: number;
  rowSpan: number;
  surfaces: Surface[];
};

export function ProjectForm({ project: initial }: { project: Project }) {
  const router = useRouter();
  const [project, setProject] = useState(initial);
  const [activeSurfaceId, setActiveSurfaceId] = useState<string>(
    initial.surfaces[0]?.id ?? ""
  );
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [slugDraft, setSlugDraft] = useState(initial.slug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  const activeSurface = useMemo(
    () =>
      project.surfaces.find((s) => s.id === activeSurfaceId) ??
      project.surfaces[0],
    [project.surfaces, activeSurfaceId]
  );

  // ── Project-level field updates (title, description, sourceUrl) ──
  const debouncedProjectSave = (patch: Partial<Project>) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void saveProject(project.id, patch), 600);
  };

  const updateProject = (patch: Partial<Project>, immediate = false) => {
    setProject((p) => ({ ...p, ...patch }));
    if (immediate) void saveProject(project.id, patch);
    else debouncedProjectSave(patch);
  };

  // ── Surface helpers ──
  const patchSurface = (id: string, patch: Partial<Surface>) =>
    setProject((p) => ({
      ...p,
      surfaces: p.surfaces.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  const setSurfaceImages = (
    id: string,
    update: (prev: SurfaceImage[]) => SurfaceImage[]
  ) =>
    setProject((p) => ({
      ...p,
      surfaces: p.surfaces.map((s) =>
        s.id === id ? { ...s, images: update(s.images) } : s
      ),
    }));

  const addSurface = async () => {
    const created = await createSurface(project.id, "New surface");
    if (!created) return;
    const newSurface: Surface = {
      id: created.id,
      slug: created.slug,
      name: created.name,
      body: "",
      heroImageUrl: null,
      order: created.order,
      images: [],
    };
    setProject((p) => ({ ...p, surfaces: [...p.surfaces, newSurface] }));
    setActiveSurfaceId(created.id);
  };

  const renameSurface = async (id: string, name: string) => {
    // Optimistic name update; slug refresh comes from server response.
    patchSurface(id, { name });
    const res = await fetch(`/api/projects/${project.id}/surfaces/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, slug: name }),
    });
    if (res.ok) {
      const updated = (await res.json()) as { slug: string };
      patchSurface(id, { slug: updated.slug });
    }
  };

  const removeSurface = async (id: string) => {
    const ok = await deleteSurface(project.id, id);
    if (!ok) return;
    setProject((p) => {
      const next = p.surfaces.filter((s) => s.id !== id);
      // If we just deleted the active tab, switch to the first remaining.
      if (id === activeSurfaceId && next[0]) setActiveSurfaceId(next[0].id);
      return { ...p, surfaces: next };
    });
  };

  // ── Source URL capture flow ──
  const capture = async () => {
    if (!project.sourceUrl || !activeSurface) return;
    setCaptureError(null);
    setCapturing(true);
    try {
      const url = await captureUrl(project.sourceUrl);
      patchSurface(activeSurface.id, { heroImageUrl: url });
      void saveSurface(project.id, activeSurface.id, { heroImageUrl: url });
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "capture failed");
    } finally {
      setCapturing(false);
    }
  };

  // Slug edits are deliberate: cleaned + saved on blur (not debounced).
  // 409 conflicts come back from the server when another project already
  // owns the desired slug — surface the error inline and revert the draft.
  const commitSlug = async () => {
    const cleaned = slugify(slugDraft);
    if (!cleaned) {
      setSlugError("slug can't be empty");
      setSlugDraft(project.slug);
      return;
    }
    if (cleaned === project.slug) {
      setSlugDraft(cleaned);
      setSlugError(null);
      return;
    }
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: cleaned }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSlugError(data.error ?? `failed (${res.status})`);
      setSlugDraft(project.slug);
      return;
    }
    setSlugError(null);
    setProject((p) => ({ ...p, slug: cleaned }));
    setSlugDraft(cleaned);
    // Keep the owner on the project they're editing — the URL slug changed
    // so we replace the address to match without leaving the page.
    router.replace(`/projects/${cleaned}`);
  };

  const deleteProject = async () => {
    if (!confirm(`delete "${project.title}"? this cannot be undone.`)) return;
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  };

  if (!activeSurface) {
    return (
      <p className="text-[13px] text-muted">
        This project has no surfaces. Reload to recover.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Status row */}
      <div
        className="animate-fade-in flex flex-wrap items-center justify-end gap-3 text-[12px]"
        style={{ ["--reveal-delay" as string]: "40ms" }}
      >
        <div className="flex items-center gap-4">
          <SizePicker
            colSpan={project.colSpan}
            rowSpan={project.rowSpan}
            onChange={(next) => {
              setProject((p) => ({ ...p, ...next }));
              void saveProject(project.id, next);
            }}
          />
          <ProjectProtectionControl
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

      {/* Title + description + source URL */}
      <header
        className="animate-fade-rise flex flex-col gap-2"
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <EditableText
          value={project.title}
          onChange={(v) => updateProject({ title: v })}
          placeholder="Untitled project"
          as="h1"
          className="text-[20px] font-semibold tracking-[-0.018em] text-fg"
        />
        <div className="flex items-center gap-1 text-[12px] text-tertiary">
          <span aria-hidden>/projects/</span>
          <input
            value={slugDraft}
            onChange={(e) => {
              setSlugDraft(e.target.value);
              if (slugError) setSlugError(null);
            }}
            onBlur={() => void commitSlug()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setSlugDraft(project.slug);
                setSlugError(null);
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            aria-label="Project URL slug"
            className="w-[12rem] bg-transparent text-[12px] text-muted outline-none placeholder:text-tertiary focus:text-fg"
            spellCheck={false}
          />
          {slugError && (
            <span className="text-[11px] text-rose-400" role="alert">
              {slugError}
            </span>
          )}
        </div>
        <EditableText
          value={project.description}
          onChange={(v) => updateProject({ description: v })}
          placeholder="Short description, one line is fine"
          multiline
          as="p"
          className="text-[14px] text-muted"
        />
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px]">
          <span className="text-tertiary">↗</span>
          <EditableText
            value={project.sourceUrl ?? ""}
            onChange={(v) => updateProject({ sourceUrl: v || null })}
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
              {capturing ? "Capturing…" : `Capture hero → ${activeSurface.name}`}
            </button>
          )}
        </div>
        {captureError && (
          <span className="text-[12px] text-muted">{captureError}</span>
        )}
      </header>

      {/* Tab bar */}
      <div
        className="animate-fade-rise"
        style={{ ["--reveal-delay" as string]: "120ms" }}
      >
        <SurfaceTabBarEditor
          surfaces={project.surfaces.map((s) => ({
            id: s.id,
            slug: s.slug,
            name: s.name,
          }))}
          activeId={activeSurface.id}
          onActivate={setActiveSurfaceId}
          onAdd={() => void addSurface()}
          onRename={(id, name) => void renameSurface(id, name)}
          onDelete={(id) => void removeSurface(id)}
        />
      </div>

      {/* Active surface editor */}
      <div
        className="animate-fade-rise"
        style={{ ["--reveal-delay" as string]: "160ms" }}
        key={activeSurface.id}
      >
        <SurfaceEditor
          projectId={project.id}
          projectSlug={project.slug}
          surface={activeSurface}
          onPatch={(patch) => patchSurface(activeSurface.id, patch)}
          onImagesChange={(update) =>
            setSurfaceImages(activeSurface.id, update)
          }
        />
      </div>
    </div>
  );
}

// Bento-size picker for the project card on /portfolio. Compact preset
// menu so the owner doesn't have to think about col/row spans — just
// "small", "wide", "tall", "big", etc. Picks render a 2D mini-grid swatch
// so the visual outcome is obvious before clicking.
const SIZE_PRESETS: { label: string; col: number; row: number }[] = [
  { label: "S", col: 1, row: 1 },
  { label: "Wide", col: 2, row: 1 },
  { label: "Tall", col: 1, row: 2 },
  { label: "M", col: 2, row: 2 },
  { label: "Wider", col: 3, row: 1 },
  { label: "L", col: 4, row: 1 },
  { label: "XL", col: 4, row: 2 },
];

function SizePicker({
  colSpan,
  rowSpan,
  onChange,
}: {
  colSpan: number;
  rowSpan: number;
  onChange: (next: { colSpan: number; rowSpan: number }) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted">
      <span className="text-tertiary">Size</span>
      <div className="flex items-center gap-1 rounded-[6px] border border-border-soft bg-content/60 p-0.5">
        {SIZE_PRESETS.map((p) => {
          const active = p.col === colSpan && p.row === rowSpan;
          return (
            <button
              key={`${p.col}x${p.row}`}
              type="button"
              onClick={() => onChange({ colSpan: p.col, rowSpan: p.row })}
              title={`${p.col}×${p.row} — ${p.label}`}
              aria-pressed={active}
              aria-label={`${p.col} columns by ${p.row} rows`}
              className={
                active
                  ? "rounded-[4px] bg-fg/[0.12] px-1.5 py-0.5 font-medium text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.12)]"
                  : "rounded-[4px] px-1.5 py-0.5 text-tertiary hover:text-fg"
              }
            >
              {p.col}×{p.row}
            </button>
          );
        })}
      </div>
    </div>
  );
}
