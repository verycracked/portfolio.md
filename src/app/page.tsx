import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const page = await prisma.page.findUnique({ where: { id: "main" } });
  const owner = await isAuthed();
  const md = page?.contentMd?.trim() || "";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {md ? (
        <article className="prose prose-stone max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </article>
      ) : (
        <div className="text-stone-500">
          <p>nothing here yet.</p>
          <p className="mt-2 text-xs">
            <Link href="/edit" className="underline-offset-2 hover:underline">
              start writing →
            </Link>
          </p>
        </div>
      )}
      <footer className="mt-16 border-t border-stone-200 pt-4 text-xs text-stone-400">
        <Link href="/edit" className="underline-offset-2 hover:underline">
          {owner ? "edit" : "lock"}
        </Link>
      </footer>
    </main>
  );
}
