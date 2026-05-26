// Server-only loader for the nomo-style markdown pages living under
// `content/`. Each file has YAML frontmatter (align, theme, font, fontsize)
// and a body that uses the small DSL on top of markdown:
//   {{section}}              named section heading
//   (([label](url)))         pill-style link chip
//   ![image:WxH](url)        sized image
//   {{avatar}}               replaced with Settings.avatarUrl at render time
//
// We keep parsing here so the renderer stays a pure UI module.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

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
};

const CONTENT_DIR = path.join(process.cwd(), "content");

/** Read+parse a markdown file by slug (no `.md` extension). */
export async function readNomoDocument(slug: string): Promise<NomoDocument> {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data as NomoFrontmatter,
    body: parsed.content,
  };
}
