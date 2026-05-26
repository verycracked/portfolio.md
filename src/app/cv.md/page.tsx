import type { Metadata } from "next";
import Link from "next/link";
import { isAuthed } from "@/lib/auth";
import { readNomoDocument } from "@/lib/nomo-content";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import { NomoEditor } from "@/components/nomo-editor";

export const metadata: Metadata = {
  title: "cv",
};

export default async function CvPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ edit }, doc, owner] = await Promise.all([
    searchParams,
    readNomoDocument("cv"),
    isAuthed(),
  ]);
  const editing = owner && edit === "1";

  const containerClass = editing
    ? "mx-auto max-w-5xl px-8 py-12"
    : "mx-auto max-w-2xl px-8 py-16";

  return (
    <main className={containerClass}>
      {owner && (
        <div className="animate-fade-in mb-6 flex items-center justify-end gap-3 text-[12px]">
          {editing ? (
            <Link
              href="/cv.md"
              className="rounded-[6px] bg-fg px-3 py-1 text-[12px] font-medium text-content hover:opacity-90"
            >
              Done
            </Link>
          ) : (
            <Link
              href="/cv.md?edit=1"
              className="text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Edit
            </Link>
          )}
        </div>
      )}

      {editing ? (
        <NomoEditor
          slug="cv"
          initialRaw={doc.raw}
          avatarUrl={null}
          caseStudies={new Map()}
        />
      ) : (
        <NomoMarkdown body={doc.body} />
      )}
    </main>
  );
}
