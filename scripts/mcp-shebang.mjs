#!/usr/bin/env node
/**
 * Post-build hook for the portfolio-md MCP package. tsc strips the shebang
 * from server.ts during compilation (it sees `#!` as invalid syntax at the
 * AST level), so we prepend it back and chmod the file executable so
 * `npx portfolio-md-mcp` works after `npm install`.
 */
import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "..", "mcp", "dist", "server.js");
const shebang = "#!/usr/bin/env node\n";

const current = await readFile(target, "utf8");
if (!current.startsWith("#!")) {
  await writeFile(target, shebang + current, "utf8");
}
await chmod(target, 0o755);
