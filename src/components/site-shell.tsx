"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";

type Props = {
  avatarUrl: string | null;
  owner: boolean;
  children: ReactNode;
};

/**
 * Top-of-page chrome for the single unified site page.
 *
 * The circular avatar sits at the top, and the rest of the page content is
 * rendered as children. Owner-only edit affordances are no longer surfaced
 * here — direct routes (`/?edit=1`) still work for backstage tweaks, but the
 * default view is read-only.
 */
export function SiteShell({ avatarUrl, owner, children }: Props) {
  const searchParams = useSearchParams();
  const editing = searchParams.get("edit") === "1";
  const previewing = searchParams.get("preview") === "1";
  const editable = owner && !previewing && !editing;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      {(editable || avatarUrl) && (
        <div
          className="animate-fade-rise mb-10"
          style={{ ["--reveal-delay" as string]: "40ms" }}
        >
          <Avatar initialUrl={avatarUrl} editable={editable} />
        </div>
      )}

      {children}
    </main>
  );
}
