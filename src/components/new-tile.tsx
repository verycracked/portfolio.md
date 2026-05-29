"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { MEDIA_ACCEPT } from "@/lib/media";
import { uploadMedia } from "@/lib/media-utils";
import {
  MAIN_SCOPE,
  projectsBase,
  type GalleryScope,
} from "@/lib/gallery-scope";

type ScopedProps = { scope?: GalleryScope };

type Props = ScopedProps & (
  | {
      /** Top-level upload — new tile lands in this group on the homepage. */
      groupId: string;
      parentId?: never;
    }
  | {
      /** Sub-project upload — new tile becomes a child of this project. */
      parentId: string;
      groupId?: never;
    }
);

/**
 * Owner-only upload affordance. Sits in section headers (for the
 * homepage gallery) or above the child grid (for sub-galleries) — no
 * longer takes up a full tile slot in the bento. Two actions in one
 * compact pill:
 *
 *   • "Upload" — opens the file picker; every chosen file becomes a
 *     media tile (no title yet) in this section.
 *   • "New" — creates an empty Untitled project tile and routes to
 *     its editor so the owner can fill it in.
 */
export function NewTile(props: Props) {
  const { groupId, parentId, scope = MAIN_SCOPE } = props;
  // The view-scoped API expects `groupId` to be a ViewGroup id (the
  // groupsBase/projectsBase URL prefix already differentiates the
  // tables); same wire shape, different table.
  const target = parentId ? { parentId } : { groupId };
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const uploadAndCreate = async (files: File[]) => {
    setBusy(true);
    try {
      for (const file of files) {
        let uploaded;
        try {
          uploaded = await uploadMedia(file);
        } catch (err) {
          alert(err instanceof Error ? err.message : `upload failed: ${file.name}`);
          continue;
        }
        const proj = await fetch(projectsBase(scope), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            // Empty title = "media tile, not a project". The owner can
            // promote later by clicking the folder chip and naming it.
            title: "",
            heroImageUrl: uploaded.url,
            posterUrl: uploaded.posterUrl,
            ...target,
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

  const createBlank = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(projectsBase(scope), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Untitled project",
          isOpenable: true,
          ...target,
        }),
      });
      if (!res.ok) return;
      const project = (await res.json()) as { id: string };
      // View-scoped tiles don't have a canonical /edit route yet, so we
      // just refresh the view editor (the owner can rename inline).
      if (scope.kind === "view") {
        router.refresh();
      } else {
        router.push(`/edit/${project.id}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
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
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          fileInputRef.current?.click();
        }}
        className="inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/80 px-2 py-1 text-[11px] text-muted hover:border-border hover:text-fg disabled:opacity-50"
      >
        <UploadSimple size={11} weight="bold" aria-hidden />
        {busy ? "Uploading…" : "Upload"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          void createBlank();
        }}
        className="inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/40 px-2 py-1 text-[11px] text-tertiary hover:border-border hover:text-fg disabled:opacity-50"
      >
        <Plus size={11} weight="bold" aria-hidden />
        New
      </button>
    </div>
  );
}
