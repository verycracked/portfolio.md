// Pull standalone `![](url)` lines out of a markdown body in source order.
// The dropzone-appended uploads land as plain image tokens on their own line;
// these are the URLs we make reorderable / deletable on the rendered page.
//
// We intentionally skip sized images (`![image:WxH](…)`) because those mean
// "treat me as an avatar" and have special chrome that isn't drag-friendly.

const PLAIN_IMG_LINE = /^[ \t]*!\[\]\(([^)\s]+?)\)[ \t]*$/gm;

/** Returns the URLs of all standalone `![](url)` lines in `body`, in order. */
export function extractReorderableMediaUrls(body: string): string[] {
  const urls: string[] = [];
  PLAIN_IMG_LINE.lastIndex = 0; // shared at module scope
  let m: RegExpExecArray | null;
  while ((m = PLAIN_IMG_LINE.exec(body)) !== null) {
    // The renderer appends `#w=…&h=…` hints for sized images; plain uploads
    // never have a hash, so this strip is defensive only.
    const [base] = m[1].split("#");
    urls.push(base);
  }
  return urls;
}
