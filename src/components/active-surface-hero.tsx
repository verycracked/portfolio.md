"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ProjectHero } from "@/components/project-hero";
import { ProjectHeroFrame } from "@/components/project-hero-frame";
import { SurfaceHeroSlot } from "@/components/surface-hero-slot";
import { isVideoUrl } from "@/lib/media";

type SurfaceData = {
  id: string;
  slug: string;
  name: string;
  heroImageUrl: string | null;
};

type Props = {
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  /** Project's own hero — used as the cover for the Overview view. */
  projectHeroImageUrl: string | null;
  /** Full-length video — when set, the detail page hero plays this
   *  instead of the preview clip (heroImageUrl). */
  projectFullVideoUrl?: string | null;
  projectPosterUrl: string | null;
  projectHeroOffsetY: number;
  surfaces: SurfaceData[];
  owner: boolean;
};

/**
 * Hero region pinned above the sliding surface body. Lives in the
 * /projects/[slug] layout so it doesn't unmount on tab switches; instead
 * we swap which hero is rendered based on the active URL and crossfade
 * between them. The hero itself doesn't slide — only the textual body
 * below slides (see SurfaceSlide).
 *
 * Mapping:
 *   • Overview route → ProjectHeroFrame (drag-to-reframe for image),
 *     or ProjectHero for video
 *   • Surface route → SurfaceHeroSlot (per-surface image / upload
 *     placeholder)
 */
export function ActiveSurfaceHero({
  projectId,
  projectSlug,
  projectTitle,
  projectHeroImageUrl,
  projectFullVideoUrl,
  projectPosterUrl,
  projectHeroOffsetY,
  surfaces,
  owner,
}: Props) {
  const pathname = usePathname() ?? "";
  const overviewPath = `/projects/${projectSlug}`;

  const activeSlug = useMemo(() => {
    if (pathname === overviewPath || pathname === `${overviewPath}/`) {
      return "";
    }
    return pathname.slice(overviewPath.length + 1).split("/")[0] ?? "";
  }, [pathname, overviewPath]);

  const surface =
    activeSlug && surfaces.find((s) => s.slug === activeSlug);

  // Render nothing for the Overview view if the project has no hero set
  // (visitor sees empty space). The owner still gets the upload-capable
  // ProjectHeroFrame so they can attach one — handled below by always
  // rendering the frame when owner is true and there's no other content
  // to show.
  const showOverviewFrame = !surface;

  // On the detail page, prefer the full video for the hero when set.
  // The preview clip stays as the gallery tile's hover; the detail page
  // is where the visitor expects to see the real thing.
  const detailVideoSrc = projectFullVideoUrl || projectHeroImageUrl;
  const heroIsVideo =
    !!projectHeroImageUrl && isVideoUrl(projectHeroImageUrl);

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeSlug || "__overview__"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "linear" }}
        >
          {showOverviewFrame ? (
            projectHeroImageUrl ? (
              heroIsVideo ? (
                <div className="relative aspect-[16/10] overflow-hidden rounded-[6px] border border-border bg-hover">
                  <ProjectHero
                    src={detailVideoSrc!}
                    posterUrl={projectPosterUrl}
                    ariaLabel={projectTitle}
                  />
                </div>
              ) : (
                <div className="overflow-hidden rounded-[6px] border border-border">
                  <ProjectHeroFrame
                    projectId={projectId}
                    src={projectHeroImageUrl}
                    alt={projectTitle}
                    initialOffsetY={projectHeroOffsetY}
                    owner={owner}
                  />
                </div>
              )
            ) : null
          ) : (
            surface && (
              <SurfaceHeroSlot
                projectId={projectId}
                surfaceId={surface.id}
                initialHeroImageUrl={surface.heroImageUrl}
                alt={`${projectTitle} — ${surface.name}`}
                owner={owner}
              />
            )
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
