// Renderer for nomo-style markdown documents. Handles a small DSL layered on
// top of standard Markdown via a string-preprocessor + react-markdown
// component overrides. Stays as a server component — no client state.
//
// Token reference:
//   {{section}}             → labelled section block (anchorable)
//   (([label](url)))        → pill chip (dark rounded bg + ↗)
//   [label](url)            → bold inline link + ↗
//   ![image:WxH](url)       → sized image (square sizes render as circular
//                              avatar to match the rest of the site chrome)
//   {{avatar}}              → string substituted at render time
//
// Case-study connection: when a pill's slugified label matches a portfolio
// `Project.slug` in `context.caseStudies`, the pill renders as a
// `<CaseStudyPill>` (client component) instead of a plain `<a>`. That's the
// seam for the hover tooltip — wired here, designed in a follow-up pass.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { Components } from "react-markdown";
import type { ProjectSummary } from "@/lib/case-study";
import { CaseStudyPill } from "@/components/case-study-pill";
import { MediaBlock } from "@/components/media-reorder";
import { PillArrow } from "@/components/pill-arrow";
import { isVideoUrl } from "@/lib/media";
import { slugify } from "@/lib/slug";

/** Hidden marker we push into the markdown title attribute so the `a`
 *  override can tell pill links apart from bold links. */
const PILL_TITLE = "__nomo_pill__";

/** Shared pill chrome — used by plain pills and case-study pills alike.
 *  Rounded-[6px] + soft inset ring + bg-hover gives the same chip look the
 *  rest of the site uses for inline tokens; hover bumps the bg one shade
 *  lighter for affordance. */
const INLINE_PILL_CLASS =
  "nomo-pill mx-0.5 inline-flex items-center gap-1.5 rounded-[6px] bg-hover px-2 py-0.5 align-middle text-[14px] leading-none text-fg ring-1 ring-inset ring-border-soft transition-colors hover:bg-border";
const STANDALONE_PILL_CLASS =
  "nomo-pill inline-flex w-fit items-center gap-1.5 rounded-[6px] bg-hover px-2 py-1.5 text-[14px] leading-none text-fg ring-1 ring-inset ring-border-soft transition-colors hover:bg-border";

type RenderContext = {
  /** Replaces `{{avatar}}` in the markdown source. */
  avatarUrl?: string | null;
  /** Map of slug → portfolio project for pills that should surface a case
   *  study on hover. Matched by slugified pill label. */
  caseStudies?: Map<string, ProjectSummary>;
};

type Pill = { label: string; url: string };

type SectionKind =
  | { kind: "markdown"; body: string }
  | { kind: "pills"; pills: Pill[] };

type NomoSection = { name: string | null } & SectionKind;

/** Pull a plain-text label out of react-markdown's children. Pills generally
 *  receive a single string child (e.g., "starbase") so we just stringify. */
function extractPillLabel(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractPillLabel).join("");
  return "";
}

/** Substitute the `{{avatar}}` placeholder. Done before section splitting so
 *  it works regardless of where the placeholder appears. */
function substituteContext(source: string, ctx: RenderContext): string {
  return source.replace(/\{\{avatar\}\}/g, ctx.avatarUrl ?? "");
}

/** Convert the markdown body for a single section into something
 *  react-markdown can render. Order matters. */
function preprocessBody(source: string): string {
  return source
    .replace(
      /\(\(\[(.+?)\]\((.+?)\)\)\)/g,
      (_full, label: string, url: string) => `[${label}](${url} "${PILL_TITLE}")`
    )
    .replace(
      /!\[image:(\d+)x(\d+)\]\((.+?)\)/g,
      (_full, w: string, h: string, url: string) => `![](${url}#w=${w}&h=${h})`
    );
}

const PILL_LINE_RE = /^\s*\(\(\[(.+?)\]\((.+?)\)\)\)\s*$/;

/** Extract pills if every non-empty line of the body is a single `(([…]))`
 *  token. Returns null when the section has any non-pill content. */
function tryExtractPills(body: string): Pill[] | null {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const pills: Pill[] = [];
  for (const line of lines) {
    const match = line.match(PILL_LINE_RE);
    if (!match) return null;
    pills.push({ label: match[1], url: match[2] });
  }
  return pills;
}

/** Split a body into named sections delimited by `{{section_name}}` lines,
 *  then classify each section as either a tight pill-list or normal markdown. */
function splitSections(body: string): NomoSection[] {
  const raw: { name: string | null; body: string }[] = [{ name: null, body: "" }];
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*\{\{(.+?)\}\}\s*$/);
    if (match) {
      raw.push({ name: match[1].trim(), body: "" });
    } else {
      raw[raw.length - 1].body += `${line}\n`;
    }
  }
  return raw
    .map((s) => ({ ...s, body: s.body.trim() }))
    .filter((s) => s.body.length > 0 || s.name !== null)
    .map<NomoSection>((s) => {
      const pills = tryExtractPills(s.body);
      if (pills) return { name: s.name, kind: "pills", pills };
      return { name: s.name, kind: "markdown", body: preprocessBody(s.body) };
    });
}

/** Heuristic for whether a link should open in a new tab. */
function isExternal(href: string): boolean {
  if (href.startsWith("/")) return false;
  if (href.startsWith("#")) return false;
  return /^https?:\/\//.test(href) || href.endsWith(".pdf") || href.startsWith("mailto:");
}

/** Standalone pill renderer used inside pill-only sections. Branches on the
 *  case-studies map: matched pills render as a `<CaseStudyPill>` (client) so
 *  they can show a tooltip on hover; the rest fall back to a plain `<a>`. */
function NomoPill({
  label,
  href,
  caseStudies,
}: {
  label: string;
  href: string;
  caseStudies?: Map<string, ProjectSummary>;
}) {
  const external = isExternal(href);
  const project = caseStudies?.get(slugify(label));

  if (project) {
    return (
      <CaseStudyPill
        href={href}
        external={external}
        label={label}
        className={STANDALONE_PILL_CLASS}
        project={project}
      />
    );
  }

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={STANDALONE_PILL_CLASS}
    >
      <span>{label}</span>
      <PillArrow />
    </a>
  );
}

/** Build the react-markdown component overrides with closure over the
 *  render context — the `a` override needs caseStudies to detect matches. */
function buildComponents(ctx: RenderContext): Components {
  return {
    a({ href, title, children }) {
      const url = href ?? "#";
      const external = isExternal(url);
      const target = external ? "_blank" : undefined;
      const rel = external ? "noopener noreferrer" : undefined;
      const pill = title === PILL_TITLE;

      if (pill) {
        const label = extractPillLabel(children);
        const project = ctx.caseStudies?.get(slugify(label));

        if (project) {
          return (
            <CaseStudyPill
              href={url}
              external={external}
              label={children}
              className={INLINE_PILL_CLASS}
              project={project}
            />
          );
        }

        return (
          <a href={url} target={target} rel={rel} className={INLINE_PILL_CLASS}>
            <span>{children}</span>
            <PillArrow />
          </a>
        );
      }

      // Plain inline link — bold label + small ↗ following it on the
      // baseline. No flex container so the arrow flows as a normal inline
      // sibling of the text (matches the nomo render).
      return (
        <a
          href={url}
          target={target}
          rel={rel}
          className="font-semibold text-fg underline-offset-2 hover:underline"
        >
          {children}
          <ArrowUpRight
            weight="bold"
            size={11}
            aria-hidden
            className="ml-0.5 inline-block align-baseline text-tertiary"
          />
        </a>
      );
    },
    img({ src, alt }) {
      if (!src || typeof src !== "string") return null;
      const [base, hash] = src.split("#");
      const params = new URLSearchParams(hash ?? "");
      const w = params.get("w");
      const h = params.get("h");
      const width = w ? Number(w) : undefined;
      const height = h ? Number(h) : undefined;
      // Unsized images (the dropzone always appends `![](url)` with no
      // dimensions) are treated as reorderable media blocks. MediaBlock
      // falls back to plain rendering when the user isn't an owner OR the
      // URL isn't in the active reorder context, so visitors see the same
      // markup as before.
      const sized = width !== undefined || height !== undefined;
      if (!sized) {
        return <MediaBlock url={base} alt={alt} />;
      }
      // Video URLs (mp4/webm) come in through the same `![](url)` syntax so
      // dropped uploads always Just Work. Autoplay muted+loop matches the
      // gallery treatment so videos read like animated hero stills.
      if (isVideoUrl(base)) {
        return (
          <video
            src={base}
            width={width}
            height={height}
            className="rounded-[6px]"
            muted
            loop
            playsInline
            autoPlay
          />
        );
      }
      // Square images are treated as avatars — circular crop, border + content
      // background to match the chrome the rest of the site uses.
      const isAvatar = width && height && width === height;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={base}
          alt={alt ?? ""}
          width={width}
          height={height}
          className={
            isAvatar
              ? "overflow-hidden rounded-full border border-border bg-content object-cover"
              : "rounded-[6px]"
          }
        />
      );
    },
    p({ children }) {
      return <p className="text-[16px] leading-[1.7] text-fg">{children}</p>;
    },
  };
}

/** The public component. Receives raw markdown body + a render context. */
export function NomoMarkdown({
  body,
  context = {},
}: {
  body: string;
  context?: RenderContext;
}) {
  const substituted = substituteContext(body, context);
  const sections = splitSections(substituted);
  const components = buildComponents(context);

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section, i) => (
        <section
          key={section.name ?? `lead-${i}`}
          id={section.name ?? undefined}
          className="flex flex-col gap-4"
        >
          {section.name && (
            <h2 className="text-[12px] lowercase text-tertiary">{section.name}</h2>
          )}
          {section.kind === "pills" ? (
            <ul className="flex flex-col items-start gap-1.5">
              {section.pills.map((p) => (
                <li key={`${p.label}-${p.url}`}>
                  <NomoPill
                    label={p.label}
                    href={p.url}
                    caseStudies={context.caseStudies}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-2">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={components}
              >
                {section.body}
              </ReactMarkdown>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
