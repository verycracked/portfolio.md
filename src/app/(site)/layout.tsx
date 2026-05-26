import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteShell } from "@/components/site-shell";

/**
 * Layout shared by `/` (about) and `/portfolio` (portfolio). Persists
 * across navigation between them so the SiteShell (avatar + tabs + owner
 * actions) doesn't unmount — letting the active tab indicator animate via
 * motion's shared `layoutId`.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, owner] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "main" } }),
    isAuthed(),
  ]);

  return (
    <SiteShell avatarUrl={settings?.avatarUrl ?? null} owner={owner}>
      {children}
    </SiteShell>
  );
}
