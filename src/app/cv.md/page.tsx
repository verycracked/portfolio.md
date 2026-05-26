import type { Metadata } from "next";
import { readNomoDocument } from "@/lib/nomo-content";
import { NomoMarkdown } from "@/lib/nomo-markdown";

export const metadata: Metadata = {
  title: "cv",
};

export default async function CvPage() {
  const doc = await readNomoDocument("cv");
  return (
    <main className="mx-auto max-w-2xl px-8 py-16">
      <NomoMarkdown body={doc.body} />
    </main>
  );
}
