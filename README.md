# portfolio.md

A Notion-style block editor for your portfolio. Single-user, password-locked, Markdown in/out.

Edit at `/edit`, publish, and your work is live at `/[your-username]`.

## What's working

- **Editor** — BlockNote (Notion-style blocks): paragraphs, headings, lists, code, tables, quotes, dividers. Slash menu, drag handles, formatting toolbar.
- **Markdown import** — drop a `.md` file → blocks
- **Markdown export** — one click → `.md` download
- **Image upload** — drag/drop or paste in the editor → uploaded to Cloudflare R2, inserted as image block
- **URL capture** — paste a URL → headless Chrome screenshot → uploaded to R2 → inserted as image
- **Multi-page** — each user has multiple pages (`home`, `projects`, etc.). `/[user]` is home; `/[user]/[slug]` is anything else.
- **Public page nav** — published pages auto-link in a small chip nav
- **Per-page appearance** — theme (light/dark/system), font, align, font size, all editable in the editor
- **Publish/draft toggle** — only published pages are visible to the public; you (the owner) always see drafts
- **Password lock** — single `OWNER_PASSWORD` env var, HMAC-signed cookie session, 30-day TTL

## Stack

- Next.js 16 (App Router, Turbopack) on Vercel
- BlockNote + react-markdown + remark-gfm
- Prisma + Postgres (Neon)
- Cloudflare R2 for images & captures
- Playwright + @sparticuz/chromium for URL screenshots
- Tailwind v4 + Geist + `@tailwindcss/typography`

## Local setup

```bash
cp .env.example .env.local
# fill in DATABASE_URL, OWNER_*, R2_*, SESSION_SECRET

pnpm install
pnpm exec prisma db push
pnpm dev
# → http://localhost:3001 (or 3000 if free)
```

Open `/lock`, enter `OWNER_PASSWORD`, you're in.

## Env vars

| key                    | what                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`         | Postgres connection string (Neon)                                    |
| `OWNER_USERNAME`       | the username your portfolio lives at: `/[username]`                  |
| `OWNER_NAME`           | your display name (shown on portfolio)                               |
| `OWNER_AVATAR_URL`     | avatar URL (e.g. github avatar)                                      |
| `OWNER_PASSWORD`       | the password to unlock `/edit`                                       |
| `SESSION_SECRET`       | `openssl rand -base64 32`                                            |
| `R2_ACCOUNT_ID`        | Cloudflare account ID                                                |
| `R2_ACCESS_KEY_ID`     | R2 token key                                                         |
| `R2_SECRET_ACCESS_KEY` | R2 token secret                                                      |
| `R2_BUCKET`            | bucket name                                                          |
| `R2_PUBLIC_URL`        | public URL of the bucket                                             |
| `LOCAL_CHROMIUM_PATH`  | optional: full path to Chrome for capture in dev (auto-detected)     |

## Routes

| route                     | what                                                  |
| ------------------------- | ----------------------------------------------------- |
| `/`                       | landing — links to your portfolio + edit              |
| `/lock?next=…`            | password gate                                         |
| `/edit`                   | editor for `home` page                                |
| `/edit?slug=…`            | editor for any other page                             |
| `/edit/new`               | create new page                                       |
| `/[username]`             | public home page                                      |
| `/[username]/[slug]`      | public sub-page                                       |
| `/api/login` POST         | password → session cookie                             |
| `/api/logout` POST        | clears cookie                                         |
| `/api/page` PUT           | upsert page (slug + content + appearance + published) |
| `/api/page?slug=…` DELETE | delete a non-home page                                |
| `/api/upload` POST        | multipart upload → R2                                 |
| `/api/capture` POST       | `{url}` → headless screenshot → R2                    |

## Data model

- `User` — single user (the owner, identified by `OWNER_USERNAME`)
- `Page` — `(userId, slug)` unique. Holds BlockNote JSON, derived markdown, appearance fields, published flag.
- `Asset` — every uploaded file, one row per upload

## Deploy to Vercel

```bash
pnpm dlx vercel link
pnpm dlx vercel env pull .env.production.local  # or push from .env.local
pnpm dlx vercel --prod
```

After deploy:
1. Update `OWNER_PASSWORD` to a real password
2. Make sure all R2 + DB env vars are set in Vercel project settings
3. R2 token + bucket should be production-grade, not the dev one
4. Visit `https://your-app.vercel.app/lock`

## Future moves

- Custom domains (`vc.dev` → portfolio)
- Drag-to-reorder pages
- OG image generation per page
- Soft-delete + revision history
- Theme presets matching nomo's `adn` flavor
- Mobile-optimized BlockNote menus
