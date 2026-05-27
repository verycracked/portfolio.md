"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, GitFork } from "@phosphor-icons/react/dist/ssr";

type OtherProject = {
  id: string;
  title: string;
  slug: string;
};

type Props = {
  projectId: string;
  initialIsOpenable: boolean;
  initialParentId: string | null;
  hasChildren: boolean;
  /** Every other project (excluding self + own descendants), for the
   *  parent picker. Server pre-filters to avoid an infinite loop. */
  parentOptions: OtherProject[];
};

/**
 * Owner-only controls for the project's place in the gallery hierarchy:
 *
 *  • Openable toggle — when on, the homepage tile becomes clickable even
 *    if the project has no sub-projects. Always-on (disabled) when the
 *    project already has children since the link is forced.
 *  • Parent picker — assign this project as a sub-project of another, or
 *    "(none)" to move it back to top-level on the homepage. Selecting a
 *    parent removes the tile from the homepage and puts it in the
 *    parent's sub-gallery.
 *
 * Both controls write through directly to `PUT /api/projects/[id]` and
 * call `router.refresh()` on success so adjacent UI (e.g. the picker's
 * own option list) re-syncs.
 */
export function ProjectStructureControl({
  projectId,
  initialIsOpenable,
  initialParentId,
  hasChildren,
  parentOptions,
}: Props) {
  const router = useRouter();
  const [isOpenable, setIsOpenable] = useState(initialIsOpenable);
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [busy, setBusy] = useState(false);

  const save = async (patch: { isOpenable?: boolean; parentId?: string | null }) => {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onToggleOpenable = () => {
    const next = !isOpenable;
    setIsOpenable(next);
    void save({ isOpenable: next });
  };

  const onPickParent = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value === "" ? null : e.target.value;
    setParentId(next);
    void save({ parentId: next });
  };

  return (
    <section className="flex flex-col gap-4 rounded-[6px] border border-border bg-content/40 p-4">
      <h3 className="text-[12px] uppercase tracking-wide text-tertiary">
        Structure
      </h3>

      {/* Openable toggle */}
      <label className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-muted">
          <ArrowSquareOut size={14} weight="bold" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-[13px] font-medium text-fg">
            Show detail page
          </span>
          <span className="block text-[12px] text-muted">
            Make the homepage tile clickable so visitors land on this
            project's detail page. {hasChildren ? "Always on — this project has sub-projects." : ""}
          </span>
        </span>
        <input
          type="checkbox"
          checked={hasChildren || isOpenable}
          disabled={hasChildren || busy}
          onChange={onToggleOpenable}
          className="mt-1 h-4 w-4 cursor-pointer accent-fg disabled:cursor-default disabled:opacity-60"
        />
      </label>

      {/* Parent picker */}
      <label className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-muted">
          <GitFork size={14} weight="bold" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-[13px] font-medium text-fg">
            Sub-project of
          </span>
          <span className="block text-[12px] text-muted">
            Move this project into another project's sub-gallery. Pick
            &ldquo;(none)&rdquo; to keep it on the homepage.
          </span>
        </span>
        <select
          value={parentId ?? ""}
          disabled={busy}
          onChange={onPickParent}
          className="mt-0.5 rounded-[4px] border border-border bg-bg px-2 py-1 text-[12px] text-fg disabled:opacity-60"
        >
          <option value="">(none — top-level)</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
