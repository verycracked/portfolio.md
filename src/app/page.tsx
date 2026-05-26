import type { Metadata } from "next";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readNomoDocument } from "@/lib/nomo-content";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import { Avatar } from "@/components/avatar";
import type { ProjectSummary } from "@/lib/case-study";

export const metadata: Metadata = {
  title: { absolute: "vc billingsley — design engineer" },
};

// Homepage: nomo-style markdown landing page. Content lives at
// `content/human.md`; the avatar reuses the exact same <Avatar /> component
// the portfolio gallery uses. `?preview=1` puts owners into visitor mode so
// the avatar drops its upload/remove affordances.
//
// Pills whose slugified label matches a portfolio project's slug get extra
// data (passed via the caseStudies Map) so the renderer can swap them for
// `<CaseStudyPill>`s. The matching is automatic — no markdown annotation
// required; this is the "if there's a case study, surface it" connection.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ preview }, doc, settings, owner, projects] = await Promise.all([
    searchParams,
    readNomoDocument("human"),
    prisma.settings.findUnique({ where: { id: "main" } }),
    isAuthed(),
    prisma.project.findMany({
      select: {
        slug: true,
        title: true,
        description: true,
        passwordHash: true,
        // First surface gives us the hero for the tooltip preview and a
        // canonical surface slug to deep-link into.
        surfaces: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          take: 1,
          select: { slug: true, heroImageUrl: true },
        },
      },
    }),
  ]);
  const editable = owner && preview !== "1";

  const caseStudies = new Map<string, ProjectSummary>(
    projects.map((p) => [
      p.slug,
      {
        slug: p.slug,
        title: p.title,
        description: p.description,
        heroImageUrl: p.surfaces[0]?.heroImageUrl ?? null,
        firstSurfaceSlug: p.surfaces[0]?.slug ?? "overview",
        isProtected: !!p.passwordHash,
      },
    ])
  );

  return (
    <main className="mx-auto max-w-2xl px-8 py-16">
      <div
        className="animate-fade-rise mb-8"
        style={{ ["--reveal-delay" as string]: "40ms" }}
      >
        <Avatar initialUrl={settings?.avatarUrl ?? null} editable={editable} />
      </div>
      <NomoMarkdown
        body={doc.body}
        context={{ avatarUrl: settings?.avatarUrl ?? null, caseStudies }}
      />
    </main>
  );
}
