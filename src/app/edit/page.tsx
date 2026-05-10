import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Editor } from "@/components/editor";

export default async function EditPage() {
  await requireOwner("/edit");
  const page = await prisma.page.findUnique({ where: { id: "main" } });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Editor initialContent={(page?.contentJson as unknown[] | undefined) ?? []} />
    </main>
  );
}
