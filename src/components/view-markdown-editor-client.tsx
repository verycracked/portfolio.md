"use client";

import { useMemo } from "react";
import { NomoEditor } from "@/components/nomo-editor";
import type { ProjectSummary } from "@/lib/case-study";

type Props = {
  viewId: string;
  initialRaw: string;
  avatarUrl: string | null;
  caseStudies: Map<string, ProjectSummary>;
};

/**
 * Thin client wrapper that points the canonical NomoEditor at the
 * per-view About column via its onSave hook. Same source/preview UI
 * the main page uses at `/?edit=1` — but the bytes land on
 * View.aboutBody instead of the canonical Page table.
 */
export function ViewMarkdownEditorClient({
  viewId,
  initialRaw,
  avatarUrl,
  caseStudies,
}: Props) {
  const onSave = useMemo(
    () => async (raw: string) => {
      const res = await fetch(`/api/views/${viewId}/about`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aboutBody: raw }),
      });
      return res.ok;
    },
    [viewId]
  );

  return (
    <NomoEditor
      slug={`view:${viewId}`}
      initialRaw={initialRaw}
      avatarUrl={avatarUrl}
      caseStudies={caseStudies}
      onSave={onSave}
    />
  );
}
