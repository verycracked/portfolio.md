import { notFound, redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { isProjectUnlocked } from "@/lib/project-auth";
import { prisma } from "@/lib/prisma";
import { OwnerToolbar } from "@/components/owner-toolbar";
import { ProjectBackLink } from "@/components/project-back-link";
import { ProjectUnlock } from "@/components/project-unlock";
import { SurfaceTabBar } from "@/components/surface-tab-bar";
import { ActiveSurfaceHero } from "@/components/active-surface-hero";
import { SurfaceSlide } from "@/components/surface-slide";
import { FadeIn } from "@/components/fade-in";

/**
 * Shared chrome for every route under `/projects/[slug]`. By living in
 * a layout (rather than being duplicated across the Overview and surface
 * pages), this chrome stays mounted while the user clicks between tabs —
 * which is what makes the tab swap feel like an in-place body slide
 * rather than a full page reload.
 *
 * What lives here:
 *   • Owner toolbar (Preview / Share / Settings)
 *   • Back link to /
 *   • Surface tab bar (Overview + custom surfaces)
 *   • Active hero (per-tab, but rendered above the slide region — see
 *     ActiveSurfaceHero; the hero itself doesn't slide because it
 *     changes per tab and reads better as a swap than as a slide)
 *   • SurfaceSlide — wraps {children} (the actual page) and animates
 *     them in/out as the URL changes
 *
 * Unlock gate is hoisted here too so password-protected projects show
 * the unlock screen consistently from any tab URL.
 */
export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      heroImageUrl: true,
      fullVideoUrl: true,
      posterUrl: true,
      heroOffsetY: true,
      passwordHash: true,
      surfaces: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, slug: true, name: true, heroImageUrl: true },
      },
    },
  });
  if (!project) notFound();

  const owner = await isAuthed();
  if (!owner) redirect("/lock");
  const isProtected = !!project.passwordHash;
  const unlocked = isProtected ? await isProjectUnlocked(project.id) : true;
  if (isProtected && !owner && !unlocked) {
    return (
      <ProjectUnlock
        projectId={project.id}
        title={project.title}
        description={project.description}
      />
    );
  }

  // Tab-bar payload (the bar doesn't need the heavier image fields).
  const tabSurfaces = project.surfaces.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
  }));

  // Ordered slug list drives slide direction inside SurfaceSlide. The
  // Overview view sits at the start (represented as an empty string in
  // SurfaceSlide); the rest follow tab order. We pre-filter "overview"
  // so it isn't double-counted (Overview routes to the bare /projects/
  // [slug] URL, not /projects/[slug]/overview).
  const orderedSurfaceSlugs = project.surfaces.map((s) => s.slug);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      {owner && <OwnerToolbar />}

      <FadeIn>
        <ProjectBackLink />
      </FadeIn>

      {project.surfaces.length > 1 && (
        <div
          className="animate-fade-rise mt-6"
          style={{ ["--reveal-delay" as string]: "20ms" }}
        >
          {/* The tab bar reads the active slug from the URL itself,
              so we don't need to thread it down from a server render. */}
          <SurfaceTabBar
            mode="link"
            projectSlug={project.slug}
            surfaces={tabSurfaces}
          />
        </div>
      )}

      <div
        className="animate-fade-rise mt-6"
        style={{ ["--reveal-delay" as string]: "40ms" }}
      >
        <ActiveSurfaceHero
          projectId={project.id}
          projectSlug={project.slug}
          projectTitle={project.title}
          projectHeroImageUrl={project.heroImageUrl}
          projectFullVideoUrl={project.fullVideoUrl}
          projectPosterUrl={project.posterUrl}
          projectHeroOffsetY={project.heroOffsetY ?? 50}
          surfaces={project.surfaces}
          owner={owner}
        />
      </div>

      {/* The page body slides between tabs. Each route under this layout
          (Overview / surface detail) renders into {children}. */}
      <SurfaceSlide
        projectSlug={project.slug}
        orderedSurfaceSlugs={orderedSurfaceSlugs}
      >
        {children}
      </SurfaceSlide>
    </main>
  );
}
