/**
 * Unit tests for the section-aware merge. Run with `pnpm test` from mcp/.
 * Uses node:test so we don't pull vitest into a package whose whole job is
 * to be tiny enough that consumers don't notice it in their node_modules.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mergeSection } from "./merge.js";

const fixedNow = new Date("2024-05-28T00:00:00Z");

test("creates a new section when none exists", () => {
  const before = "";
  const { body, outcome } = mergeSection(before, "Recent work", "- did things", {
    now: fixedNow,
  });
  assert.equal(outcome, "created");
  assert.match(body, /^## Recent work\n/);
  assert.match(body, /_2024-05-28_/);
  assert.match(body, /- did things\n$/);
});

test("appends to an existing body when section is new", () => {
  const before = "## Overview\n\nintro paragraph\n";
  const { body, outcome } = mergeSection(before, "Recent work", "- new bullet", {
    now: fixedNow,
  });
  assert.equal(outcome, "created");
  assert.match(body, /## Overview/);
  assert.match(body, /## Recent work/);
  // The two sections must be separated by a blank line.
  assert.match(body, /intro paragraph\n\n## Recent work/);
});

test("replaces an existing section in place (case-insensitive)", () => {
  const before = [
    "## Overview",
    "",
    "intro",
    "",
    "## Recent Work",
    "_2024-01-01_",
    "",
    "- old bullet",
    "",
    "## Footer",
    "",
    "outro",
    "",
  ].join("\n");
  const { body, outcome } = mergeSection(before, "recent work", "- new bullet", {
    now: fixedNow,
  });
  assert.equal(outcome, "replaced");
  assert.ok(!body.includes("old bullet"), "old bullet should be gone");
  assert.match(body, /- new bullet/);
  // Sibling sections preserved.
  assert.match(body, /## Overview/);
  assert.match(body, /## Footer\n\noutro/);
  // Date should be refreshed.
  assert.match(body, /_2024-05-28_/);
  assert.ok(!body.includes("_2024-01-01_"));
});

test("ignores `##`-looking lines inside fenced code blocks when scanning", () => {
  // If the fence-content `## Sibling` were treated as a real heading, the
  // merger would terminate the "Real" section after the fence and the
  // `body before fence` line would survive replacement. We replace and
  // confirm everything inside the Real section (including the fence) is
  // gone, AND the genuine sibling `## Actual sibling` is preserved.
  const before = [
    "## Real",
    "",
    "body before fence",
    "",
    "```",
    "## Sibling",
    "```",
    "",
    "body after fence",
    "",
    "## Actual sibling",
    "",
    "sibling body",
    "",
  ].join("\n");
  const { body } = mergeSection(before, "Real", "replaced body", {
    now: fixedNow,
    dated: false,
  });
  assert.match(body, /replaced body/);
  assert.ok(!body.includes("body before fence"));
  assert.ok(!body.includes("body after fence"));
  // The genuine sibling heading and its body must survive — proves the
  // fence-skip didn't accidentally bleed into real heading detection.
  assert.match(body, /## Actual sibling\n\nsibling body/);
});

test("stops at next same-level heading, not deeper headings", () => {
  const before = [
    "## Top",
    "",
    "### Sub of top",
    "",
    "deep content",
    "",
    "## Other",
    "",
    "untouched",
    "",
  ].join("\n");
  const { body } = mergeSection(before, "Top", "new content", {
    now: fixedNow,
    dated: false,
  });
  // Sub of top was inside the Top section so it gets replaced.
  assert.ok(!body.includes("### Sub of top"));
  assert.ok(!body.includes("deep content"));
  // Sibling untouched.
  assert.match(body, /## Other\n\nuntouched/);
});

test("append mode always pushes a duplicate", () => {
  const before = "## Log\n\n- first\n";
  const { body, outcome } = mergeSection(before, "Log", "- second", {
    mode: "append",
    dated: false,
    now: fixedNow,
  });
  assert.equal(outcome, "appended");
  // Two H2 "Log" headings in the body, in order.
  const matches = body.match(/^## Log$/gm) ?? [];
  assert.equal(matches.length, 2);
});

test("dated:false omits the date line entirely", () => {
  const { body } = mergeSection("", "Evergreen", "body", {
    dated: false,
    now: fixedNow,
  });
  assert.ok(!body.includes("_2024-"));
});

test("idempotent on identical inputs", () => {
  const before = "";
  const first = mergeSection(before, "Recent work", "- bullet", { now: fixedNow });
  const second = mergeSection(first.body, "Recent work", "- bullet", {
    now: fixedNow,
  });
  assert.equal(first.body, second.body);
});

test("supports H3 sections when configured", () => {
  const before = "## Top\n\n### Existing sub\n\nold\n";
  const { body, outcome } = mergeSection(before, "Existing sub", "new", {
    level: 3,
    dated: false,
    now: fixedNow,
  });
  assert.equal(outcome, "replaced");
  assert.match(body, /### Existing sub\n\nnew/);
  assert.ok(!body.includes("old"));
});

test("size guard refuses oversized bodies", () => {
  const before = "## Big\n\n";
  const oversized = "a".repeat(300 * 1024);
  assert.throws(() =>
    mergeSection(before, "Big", oversized, { maxBytes: 200 * 1024 })
  );
});

test("preserves trailing newline of the source", () => {
  const out = mergeSection("", "X", "y", { dated: false, now: fixedNow });
  assert.ok(out.body.endsWith("\n"));
  assert.ok(!out.body.endsWith("\n\n"));
});
