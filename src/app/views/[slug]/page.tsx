import { redirect } from "next/navigation";

/**
 * The /views/[slug] route used to host a separate editor for views.
 * That split was a footgun — visitors at /v/[slug] could be the owner,
 * and they'd see a read-only render with no obvious "go edit this"
 * affordance, then have to bounce to /views/[slug] to actually mutate
 * anything. Same pattern as the homepage / → owner-mode-on-/ collapses
 * to: /v/[slug] now renders the editor when the visitor is the owner,
 * and the visitor read view otherwise.
 *
 * This route still resolves so old bookmarks / share links work, but
 * it just bounces to the canonical public URL.
 */
export default async function LegacyViewEditorRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/v/${slug}`);
}
