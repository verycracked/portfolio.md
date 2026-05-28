/**
 * Section-aware merge for surface body markdown. The contract:
 *
 *  - A "section" is the slice from a heading at the chosen level up to (but
 *    not including) the next heading at the same or higher level, or EOF.
 *  - Match is case-insensitive on trimmed heading text. Whitespace inside
 *    the heading is normalized to single spaces before comparing so
 *    "##  Recent work" and "## recent  work" match.
 *  - `mode: "replace"` rewrites in place when found, otherwise appends.
 *  - `mode: "append"` always appends a new section even if a same-named one
 *    already exists. Useful for changelog-style logs.
 *  - The output is idempotent on identical inputs.
 *
 * No external markdown parser is used — sections are detected line-by-line.
 * That's deliberate: this code runs inside an MCP server and the input is
 * just whatever the agent typed. Pulling in a full AST is overkill.
 */

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*$/;
const CODE_FENCE_RE = /^(```|~~~)/;

export type MergeMode = "replace" | "append";

export type MergeOptions = {
  /** H2 by default — matches the seed convention in scripts/seed-case-study. */
  level?: 2 | 3;
  /** Replace-in-place vs always-append. */
  mode?: MergeMode;
  /** Insert an italic "_YYYY-MM-DD_" line under the heading. */
  dated?: boolean;
  /** Override "today" for tests. */
  now?: Date;
  /** Refuse to produce bodies larger than this. Default 200 KB. */
  maxBytes?: number;
};

export type MergeResult = {
  body: string;
  /** "created" — section didn't exist; "replaced" — overwrote existing; "appended" — pushed a duplicate. */
  outcome: "created" | "replaced" | "appended";
};

const DEFAULT_MAX_BYTES = 200 * 1024;

/** Normalize whitespace for case-insensitive heading comparison. */
function normalizeHeading(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function today(now?: Date): string {
  const d = now ?? new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Walk the body line-by-line and emit either the original section span or
 * a replacement, depending on whether we hit the target heading. Skips
 * `#` lines inside fenced code blocks (those aren't real headings).
 */
type SectionSpan = {
  startLine: number; // inclusive — the heading line
  endLine: number; // exclusive — first line of the next same-or-higher heading, or lines.length
};

function findSection(
  lines: string[],
  level: 2 | 3,
  needle: string
): SectionSpan | null {
  const target = normalizeHeading(needle);
  let inFence = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (CODE_FENCE_RE.test(line)) {
      inFence = !inFence;
      i++;
      continue;
    }
    if (!inFence) {
      const match = HEADING_RE.exec(line);
      if (match && match[1] && match[1].length === level) {
        if (normalizeHeading(match[2] ?? "") === target) {
          const startLine = i;
          let j = i + 1;
          let innerFence = false;
          while (j < lines.length) {
            const inner = lines[j] ?? "";
            if (CODE_FENCE_RE.test(inner)) {
              innerFence = !innerFence;
              j++;
              continue;
            }
            if (!innerFence) {
              const m2 = HEADING_RE.exec(inner);
              if (m2 && m2[1] && m2[1].length <= level) {
                return { startLine, endLine: j };
              }
            }
            j++;
          }
          return { startLine, endLine: lines.length };
        }
      }
    }
    i++;
  }
  return null;
}

function renderSection(
  level: 2 | 3,
  section: string,
  content: string,
  dated: boolean,
  now?: Date
): string {
  const heading = `${"#".repeat(level)} ${section.trim()}`;
  const dateLine = dated ? `\n_${today(now)}_\n` : "";
  // Trim trailing whitespace on the content but preserve internal blank lines.
  const body = content.replace(/\s+$/g, "");
  return `${heading}\n${dateLine}\n${body}\n`;
}

export function mergeSection(
  currentBody: string,
  section: string,
  content: string,
  options: MergeOptions = {}
): MergeResult {
  const level = options.level ?? 2;
  const mode = options.mode ?? "replace";
  const dated = options.dated ?? true;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  // Preserve the trailing newline state of the source so successive merges
  // don't accumulate or strip blank lines unpredictably.
  const sourceEndedWithNewline = currentBody.length === 0 || currentBody.endsWith("\n");
  const lines = currentBody.split("\n");
  // split() on a string ending in "\n" yields a trailing "" — drop it so we
  // operate on real content lines. We re-add it on output if needed.
  if (sourceEndedWithNewline && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const span = mode === "replace" ? findSection(lines, level, section) : null;
  const rendered = renderSection(level, section, content, dated, options.now);

  let nextBody: string;
  let outcome: MergeResult["outcome"];

  if (span) {
    const before = lines.slice(0, span.startLine).join("\n");
    const after = lines.slice(span.endLine).join("\n");
    const parts: string[] = [];
    if (before) parts.push(before.replace(/\n+$/, ""));
    parts.push(rendered.replace(/\n+$/, ""));
    if (after) parts.push(after.replace(/^\n+/, ""));
    nextBody = parts.join("\n\n");
    outcome = "replaced";
  } else {
    const base = lines.join("\n").replace(/\n+$/, "");
    nextBody = base ? `${base}\n\n${rendered.replace(/\n+$/, "")}` : rendered.replace(/\n+$/, "");
    // Distinguish "first time we've ever seen this section" from "user asked
    // to append a duplicate".
    outcome =
      mode === "append" && findSection(lines, level, section) ? "appended" : "created";
  }

  // Always end with a single trailing newline. POSIX-friendly, and the
  // BlockNote renderer is happier with it.
  nextBody = `${nextBody}\n`;

  if (Buffer.byteLength(nextBody, "utf8") > maxBytes) {
    throw new Error(
      `merged body would exceed ${maxBytes} bytes; refusing to write to keep the editor responsive`
    );
  }

  return { body: nextBody, outcome };
}
