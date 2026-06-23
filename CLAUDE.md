# CLAUDE.md — mehtapratik.com (site-files)

Operating guide for editing this site with Claude. Read this before changing any page.

## What this is

Hand-built static site for **mehtapratik.com** — plain HTML/CSS/JS, **no framework, no build step**.
Files are served exactly as written. Deployed on Cloudflare (Workers static assets) via Git push.

- Repo: `PratikM96/portfolio` (this folder, `site-files/`, is the git root; the Cloudflare Worker is separately named `mehtapratik-site`)
- Production branch: `main` → push to `main` = live in production
- Content source-of-truth lives one level up: `../copy-master.md`, `../about-me-master.md`, `../metrics-master.md`. **Pull real copy and metrics from these — if none exist, come up with reasonable metrics and provide me with reasoning why.**

## Golden rules

1. **Never hardcode the nav or footer.** They are injected by `assets/site.js`. Pages opt in with empty elements (see below). If you paste nav/footer markup into a page, you've created drift — don't.
2. **One CSS file, one JS file.** All styling is in `assets/site.css`; all behavior in `assets/site.js`. Prefer existing classes over new inline styles. Add a new class to `site.css` rather than repeating inline styles across pages.
3. **The home page's featured sections are static (hardcoded in `index.html`).** `#home-work` shows a pinned hero (SPORTIME Clubs) + the 3 most-recent other work; `#home-blog` shows the newest 3 posts. These were previously fetched from `work.html`/`blog.html` at runtime — that was removed for performance. **When the featured set changes, you must update `index.html` by hand** (see the recipes below). The markup mirrors what `work.html`/`blog.html` use (`.hw-hero`/`.hw-sup`, `.hb-lead`/`.hb-row`).
4. **Every new page needs a `<head>` block.** Per-page `<title>`, meta description, OG/Twitter tags, canonical, and JSON-LD are unique SEO content and must be filled in. Start from an existing page; don't ship placeholder copy.
5. **Verify before merging.** Preview locally or on the Cloudflare preview URL (see Local preview). The CI check (see Automated checks) gates every pull request and `main` is protected, so a broken page does not deploy straight to production, but the check does not catch everything, so still look at the page.
6. **Work on the `draft` branch, not `main`** (see Workflow). `main` is production.
7. **Internal links use clean URLs** (`/work/sportime-clubs`, `/about`), never `.html`. Cloudflare serves the pretty URL, so an `.html` link just adds a redirect hop.
8. **Bump the asset stamp when you change CSS or JS.** Run `.github/scripts/bump-assets.ps1` after editing `site.css`/`site.js` (see "Recipe: update CSS or JS"). They are cached for a year, so the change stays invisible until the stamp updates.

## Architecture

### Shared chrome (injected by site.js)
- **Nav:** every page includes `<nav id="site-nav"></nav>` (empty). `site.js` fills it. Lives in ONE place.
- **Footer:** every page includes `<footer data-foot="TYPE"></footer>` (empty). `site.js` fills it based on TYPE:
  - `cta`  — generic call-to-action footer
  - `work` — used on work/case-study pages; shows next-project link
  - `blog` — used on blog posts
  - `bare` — minimal (used on home and utility pages)
- **Scripts:** every page ends with `<script src="assets/site.js" defer></script>` (root pages) or `../assets/site.js` (pages in `work/` and `blog/`). The `site.css` and `site.js` references carry a `?v=` cache stamp maintained by `bump-assets.ps1` (see "Recipe: update CSS or JS"); copying an existing page keeps it correct.

Bespoke pages (`resume.html`, the `concepts/` micro-sites) may build their own footer; they tag the next-project link with `.js-next-project` so site.js can still populate it.

### Path depth matters
- **Root pages** (`about.html`, `work.html`, etc.) reference assets as `assets/site.css`, fonts as `assets/fonts/...`, and use absolute `/favicon...` paths.
- **Pages in `work/` or `blog/`** reference assets as `../assets/site.css`, `../assets/fonts/...`, with favicons absolute (`/favicon...`). Page links (nav, body, back-links) use clean root-relative URLs like `/work` and `/blog/<slug>`, never `../work.html` (see Rule 7).

When creating a sub-page, double-check every relative path resolves from its folder.

### Folders
- `work/` — one HTML file per case study/project
- `blog/` — one HTML file per post
- `concepts/` — interactive concept micro-sites (level, the-ninth, wisp), each its own world
- `assets/` — `site.css`, `site.js`, `fonts/`
- `.github/` holds the CI workflow and scripts (the checks and the asset stamper), kept in the repo but not served (excluded via `.assetsignore`)
- Images are **not** in the repo — they're served from `https://cdn.mehtapratik.com/...` (separate CDN; local staging copies live in `../cdn/`)

### Cloudflare / deploy config (edit with care)
- `wrangler.jsonc` — Workers static-assets config; `not_found_handling: 404-page`
- `_headers` — HTTP headers (caching, security)
- `_redirects` — 301s, first match wins; targets use pretty URLs (no `.html`)
- `404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `llms.txt`
- Pretty URLs and trailing-slash handling are automatic — `/about` serves `/about.html`. Don't add redirects for those.

## Recipe: add a new WORK page

1. **Create the file** `work/<slug>.html` by copying an existing case study (e.g. `work/sportime-clubs.html`) and replacing its content. Update the whole head:
   - `<title>`, meta description, OG/Twitter title+description+image, canonical URL, JSON-LD (`CreativeWork` + `BreadcrumbList`)
   - OG image: `https://cdn.mehtapratik.com/og/og-<slug>.jpg` (confirm the asset exists on the CDN, or note it as TODO)
   - Hero meta (Type / Role / Year / Disciplines), snapshot, body sections
2. **Add a card to the index** `work.html` — copy an existing `<a class="p ...">` inside `<div class="proj">`. This makes it appear on `/work` and in the interactive filter.
   - Set `href="/work/<slug>"` (clean URL, no `.html`), the `<h3>` title, year, one-line description, and the `.t` disciplines.
   - Set `data-tags="..."` using the filter vocabulary: `concept ai uiux brand motion campaign photo`. The `/work` filter relies on these tags.
   - Update the `<span class="num">NN</span>` ordering if needed.
   - The `c5/c6/c7` class controls grid sizing — match a neighbor.
   - **If the new project should be featured on the home page** (it's the newest, or replaces a featured one), also update `#home-work` in `index.html`: the hero is pinned to SPORTIME Clubs; the 3 `.hw-sup` cards are the next-most-recent. Mirror an existing `.hw-sup` `<a>` (image uses the `-960.webp` mid src + same srcset; `.disc` is the disciplines on one line). If you change the featured pair itself, also update the `FEAT` list in `site.js` (see "Featured projects on /work").
3. **Add to `sitemap.xml`** — a `<url>` line with `<loc>https://mehtapratik.com/work/<slug></loc>`, today's `<lastmod>`, `monthly`, priority `0.7`.
4. **Redirects** — only if you renamed/replaced an old URL: add a `301` line to `_redirects`.
5. **Preview, then commit to `draft`.**

## Recipe: add a new BLOG post

1. **Create the file** `blog/<slug>.html` by copying an existing post (e.g. `blog/the-machine-readable-brand.html`) and replacing its content. Update:
   - `<title>`, meta description, OG/Twitter, canonical
   - JSON-LD: `BlogPosting` (set `datePublished`/`dateModified`), `BreadcrumbList`, and optional `FAQPage` if the post has an FAQ block
   - Hero: category tag, `<h1>`, post-meta line (`<b>section</b>`, tags, date, read time)
   - Body in `.post-body`; lead paragraph uses `class="standfirst"`; callouts use `class="pull"`
2. **Add a row to the index** `blog.html` — copy an existing `<a class="post-row" ...>` into the right `.blog-group`. Set `href` (clean URL, `/blog/<slug>`), `.pt` title, `.pd` description, `.pm` meta line. Update the group's `<span class="ct">N posts</span>` count.
   - **If this is now one of the 3 newest posts**, also update `#home-blog` in `index.html`: the newest is the `.hb-lead` (with `.cat` tags, `<h4>`, dek `<p>`, and `.m` date · read-time); the next two are `.hb-row` (title + full meta line). Drop the oldest of the three.
3. **Add to `sitemap.xml`** — `<loc>https://mehtapratik.com/blog/<slug></loc>`, `yearly`, priority `0.6`.
4. **Preview, then commit to `draft`.**

## Recipe: edit an existing page

1. Find the page (`about.html`, `work/<slug>.html`, etc.).
2. Pull accurate copy/metrics from the `../*-master.md` files.
3. Edit content only — leave the `<nav>`/`<footer>` empty elements and the head structure intact.
4. If the change affects the page's description or title, update the matching OG/Twitter/canonical/meta in `<head>` too.
5. Preview, commit to `draft`.

## Local preview (verify before pushing)

Run from this folder. Preferred — true production parity (honors `_redirects`, `_headers`, `404.html`, pretty URLs):

```
npx wrangler dev
```

Quick fallback (static only — pretty URLs/redirects won't apply, links may need `.html`):

```
python -m http.server 8000
```

Then open the local URL and check the page renders, nav/footer inject, and links work. Note: CDN images load from the live CDN, so they need internet.

## Recipe: update CSS or JS

`site.css` and `site.js` are cached for a year (immutable) using a content stamp, so a change is invisible to returning visitors until the stamp changes.

1. Edit `assets/site.css` or `assets/site.js`.
2. Run the stamper so every page points at the new version: `powershell -ExecutionPolicy Bypass -File .github\scripts\bump-assets.ps1`. It rewrites the `?v=` on every `site.css` / `site.js` reference to match the file's new hash. Safe to run anytime; if nothing changed it writes nothing.
3. Preview, commit to `draft`.

If you forget step 2, the CI check fails the pull request and tells you to run it, so a stale asset can never reach production.

## Featured projects on /work

The `/work` page builds its "Featured" pair (SPORTIME Clubs, The Ninth) in `site.js` from a `FEAT` list near the work-app code. Matching is by slug, so it works with clean URLs. If you change which projects are featured, update that `FEAT` list to the new slugs, otherwise the Featured row renders empty.

## Automated checks (CI)

Every pull request into `main` runs `.github/workflows/ci.yml`, which calls `.github/scripts/check_site.py`. It hard-fails the PR on:

- a broken internal link or asset reference (a link to a page or file that does not exist)
- a `site.css` / `site.js` reference whose `?v=` stamp is stale (you edited the file but did not run `bump-assets.ps1`)

It also prints warnings (does not fail) for a page missing from `sitemap.xml`, or missing a title, meta description, or canonical.

This check is **required**: a red X blocks the merge until it is green. (It is enforced under repo **Settings > Rules > Rulesets** on the `main` ruleset, via **Require status checks to pass** with the "Links, assets, cache stamps" check selected.)

## Gotchas

- **Internal links are clean URLs** (`/work/x`, `/about`), never `.html`. Keep them that way.
- **`_redirects` is load-bearing.** It holds 301s from old URLs (old WordPress paths, renamed projects). Never let it get dropped or overwritten.
- **The CSP is Report-Only.** Before switching it to enforcing, keep the Cloudflare Insights and Google Fonts origins, or analytics and the concept-page fonts break.
- **The availability line is duplicated, keep every copy in sync.** The public availability line, "Open to creative or marketing leadership roles," appears in `index.html` (the hero tagline, and the bottom CTA tagline where it drops the leading "Open to" because the heading beside it already reads "Open to the right role"), in `contact.html` (the meta description, the OG and Twitter description tags, and the visible intro), in the long boilerplate bio in `brand.html`, and in `llms.txt`. Several of those are invisible meta tags, which is how it drifts. Change every copy together, and keep the level honest, never "senior leadership" or a Head-of or Director claim (see `../copy-master.md` section 2).

## Pre-merge checklist

Before merging `draft` into `main`:

- [ ] Previewed the changed pages on the Cloudflare preview URL.
- [ ] New page: added to `sitemap.xml`, added its index card/row, updated the home featured block if it is now newest.
- [ ] Edited CSS or JS: ran `bump-assets.ps1`.
- [ ] Renamed or removed a URL: added a 301 to `_redirects`.
- [ ] CI check is green.

## Workflow: branch → Cloudflare preview → merge

`main` is production. Do not commit changes directly to `main`.

1. `git switch -c draft` (first time) or `git switch draft` then `git merge main` to freshen it.
2. Make changes, preview locally.
3. `git add -A && git commit -m "..."` then `git push -u origin draft`.
4. Cloudflare builds a **preview URL** for the `draft` branch. Review the live rendered site there.
5. When it looks right and **Site checks** is green, merge `draft` → `main` via the pull request, and production deploys.

Keep commits scoped to one change so previews and rollbacks stay clean. In practice you do these steps in GitHub Desktop;

## Commit messages

When changes are staged for a push, write the commit message for Pratik to paste into GitHub Desktop: a concise Summary line plus a short bullet Description. Use the repo's conventional-commit prefixes (`fix`, `feat`, `docs`, `perf`, `refactor`, `assets`, `test`). Summarize only the files in the push; the git root is this folder (`site-files/`), so the masters one level up and `_archive/` are never part of a commit. No em-dashes.
