import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";

/**
 * Legacy redirect — /views/[slug] used to host the editor. Now bounces
 * to /v/[slug]/edit for owners, /v/[slug] for visitors (so old bookmarks
 * don't leak into the edit route).
 */
export default async function LegacyViewEditorRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const owner = await isAuthed();
  redirect(owner ? `/v/${slug}/edit` : `/v/${slug}`);
}
