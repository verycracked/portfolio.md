---
name: portfolio
description: Update the user's portfolio.md site with a summary of the current project. Detects the project from the active git repo (or cwd), composes a concise section of recent work from the current session and recent commits, and writes it to the live portfolio via the API. Use when the user invokes `/portfolio`, says "update my portfolio", "log this to my portfolio", "add this project to my portfolio", or asks to publish/refresh their portfolio entry for the current repo. Safe to run from any repository.
---

# portfolio

Pushes a project section to the user's portfolio.md site. Source of truth for the skill's view of portfolio content is a local cache at `~/.claude/skills/portfolio/state/content.md` because the API does not yet expose a GET. The live site is updated via `PUT /api/page`.

## When invoked

Follow these steps in order. Stop and ask the user if any step has ambiguity.

### 1. Load config

Read `~/.claude/skills/portfolio/config.env`. Required keys:

- `PORTFOLIO_URL` — base URL of the deployed app (no trailing slash). Example: `https://portfolio.example.com`. For local testing use `http://localhost:3001`.
- `OWNER_PASSWORD` — the same value the deploy has set.

If the file doesn't exist, create it from `~/.claude/skills/portfolio/config.env.example` (copy it there if missing) and ask the user to fill in the values before continuing. Do not proceed without both keys.

### 2. Identify the project

In order of preference:

1. `git remote get-url origin` → parse the repo name (strip `.git`, take basename). Use the repo name as-is for the slug.
2. If no remote, use `basename "$(pwd)"`.

Derive a display name: title-case the slug, replacing `-` and `_` with spaces. Ask the user to confirm the display name if it looks wrong (e.g. acronyms, branded casing like `BlockNote` vs `Blocknote`). Default to the user's preferred casing if already cached from a previous run (see step 5).

### 3. Gather session context

Build a short factual summary of what was done on this project. Pull from, in order:

1. The current Claude Code conversation — features built, problems solved, decisions made. This is the primary signal; the user invoked the skill specifically because of recent session work.
2. Recent local git activity for context: `git log --oneline -20`, `git status`, `git diff --stat main...HEAD` (or `master`).
3. The repo's README (top-level only) for a one-line "what is this project" framing if the section is new.

Do NOT run network calls, search the web, or read unrelated files. Stay in-repo.

### 4. Compose the section

Render as GitHub-flavored markdown. Structure:

```
## <Display Name>

<one-sentence what-it-is line>

**Recent work** _(<YYYY-MM-DD>)_

- <crisp bullet about something built or shipped>
- <bullet>
- <bullet>

<optional: link line — `[repo](<remote url>)` and `[live](<deploy url>)` if known>
```

Constraints:

- 3–6 bullets max. Each bullet ≤ 120 chars. Past tense, concrete (what changed, not what was attempted).
- No emojis unless the user has them elsewhere in their portfolio.
- No "I" / "we" — third-person or imperative-style.
- Date is today's date in `YYYY-MM-DD`.

Show the proposed section to the user and ask for approval before pushing. The user can edit inline.

### 5. Merge with cached portfolio content

Read `~/.claude/skills/portfolio/state/content.md` (create the directory and an empty file if missing).

Find any existing H2 whose text matches the display name (case-insensitive, after trimming). Replace from that H2 to the line before the next H2 (or EOF) with the new section.

If no match: append the new section to the end of the file, separated by a single blank line.

If the cache file is empty: the new section becomes the entire content.

Write the result back to the cache atomically (write to `.tmp`, then rename).

### 6. Authenticate

```
COOKIE_JAR=$(mktemp)
curl -sS -c "$COOKIE_JAR" -X POST "$PORTFOLIO_URL/api/login" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<JSON
{"password": $(jq -Rs . <<< "$OWNER_PASSWORD")}
JSON
```

On non-2xx: surface the error message verbatim and stop. Do not retry blindly — wrong password or missing env on the deploy both surface here.

### 7. Push the updated content

```
curl -sS -b "$COOKIE_JAR" -X PUT "$PORTFOLIO_URL/api/page" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<JSON
{"contentMd": $(jq -Rs . < ~/.claude/skills/portfolio/state/content.md)}
JSON
```

On non-2xx: surface the error, restore the previous cache file (keep a `.bak` from before step 5 for exactly this reason), and stop.

Always shell-quote with `jq -Rs .` to safely encode the markdown — do not hand-build the JSON. Always `rm -f "$COOKIE_JAR"` at the end.

### 8. Report

Print:

- The section that was updated (display name).
- Whether it was a **new** section or **updated** in place.
- The diff vs. the previous cache content (use `diff -u` against the `.bak`).
- The public URL: `$PORTFOLIO_URL/$OWNER_USERNAME` if `OWNER_USERNAME` is known, otherwise `$PORTFOLIO_URL`.

Do NOT regenerate `contentJson` — the editor reconciles from `contentMd` on next load. Note this in the report so the user isn't surprised that the BlockNote editor view rebuilds on next open.

## Caveats to surface proactively

- **Drift**: if the user edits the portfolio via the web `/edit` UI between skill runs, the local cache won't reflect those edits and the next skill run will overwrite them. Recommend the user adds a `GET /api/page` endpoint and a `sync` subcommand for the skill. Until then, suggest the user only edit via the skill, or always run `/portfolio sync-from-prod` (not yet implemented) after a manual edit.
- **Single page schema**: the live schema (`prisma/schema.prisma`) has one `Page` with id `"main"`. The README's multi-page / multi-slug story isn't implemented yet. This skill puts everything in that one page as H2 sections. If multi-page lands later, the skill will need a `slug` arg.
- **No `contentJson`**: this skill writes only `contentMd`. `PUT /api/page` accepts that — `contentJson` becomes null and the editor reconstructs blocks from markdown on next load. Confirmed acceptable for this workflow.

## Subcommands

If the user passes an argument:

- `/portfolio preview` — do steps 1–4, show the proposed section, do NOT touch cache or push.
- `/portfolio dry-run` — do steps 1–5 (write cache), but skip auth and PUT. Useful for testing merging.
- `/portfolio reset` — wipe `~/.claude/skills/portfolio/state/content.md`. Ask for confirmation.

No argument = full flow (steps 1–8).

## Files this skill touches

- Reads: `~/.claude/skills/portfolio/config.env`, current repo's git metadata, current repo's README.
- Writes: `~/.claude/skills/portfolio/state/content.md` (and a `.bak` snapshot before each push).
- Network: `POST $PORTFOLIO_URL/api/login`, `PUT $PORTFOLIO_URL/api/page`.

Never write inside the project repo you're invoked from. Never commit anything.
