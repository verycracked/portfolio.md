"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { OwnerToolbar } from "@/components/owner-toolbar";

type Props = {
  avatarUrl: string | null;
  owner: boolean;
  children: ReactNode;
};

/**
 * Top-of-page chrome for the single unified site page.
 *
 * The circular avatar sits at the top, and the rest of the page content is
 * rendered as children. Owners see a small toolbar in the upper-right with
 * a Preview/Exit-preview toggle and a Share button.
 */
export function SiteShell({ avatarUrl, owner, children }: Props) {
  const searchParams = useSearchParams();
  const editing = searchParams.get("edit") === "1";
  const previewing = searchParams.get("preview") === "1";
  const editable = owner && !previewing && !editing;

  return (
    <main className="relative mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      {owner && <OwnerToolbar />}

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
