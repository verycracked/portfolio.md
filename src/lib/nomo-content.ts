// Server-only loader for the nomo-style markdown pages.
//
// Source-of-truth precedence:
//   1. DB (`Page` model, keyed by slug) — set when an owner edits in-app
//   2. File (`content/<slug>.md`) — seed/default checked into the repo
//
// Each variant has YAML frontmatter (align, theme, font, fontsize) plus the
// nomo DSL body. We parse with gray-matter regardless of where the raw
// string came from.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { prisma } from "@/lib/prisma";

export type NomoFrontmatter = {
  align?: "top" | "center" | "bottom";
  theme?: "dark" | "light";
  font?: string;
  fontsize?: string;
  title?: string;
};

export type NomoDocument = {
  frontmatter: NomoFrontmatter;
  body: string;
  /** The raw source (frontmatter + body) — what the editor textarea binds to. */
  raw: string;
  /** Where the body came from. Useful for diagnostics + future cache hints. */
  source: "db" | "file";
};

const CONTENT_DIR = path.join(process.cwd(), "content");

function parse(raw: string, source: "db" | "file"): NomoDocument {
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as NomoFrontmatter,
    body: parsed.content,
    raw,
    source,
  };
}

/** Read+parse a markdown document by slug. */
export async function readNomoDocument(slug: string): Promise<NomoDocument> {
  const dbPage = await prisma.page.findUnique({
    where: { slug },
    select: { body: true },
  });
  if (dbPage) return parse(dbPage.body, "db");

  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  const raw = await fs.readFile(filePath, "utf8");
  return parse(raw, "file");
}
