# Action plan — SEO audit 2026-05-28

Ordered by leverage. Each entry: estimated effort, expected impact, files touched. Cross-reference: see `FULL-AUDIT-REPORT.md` for detailed rationale.

## This week (the high-leverage cluster)

### 1. Fix `/db/*` canonical/trailing-slash mismatch
- **Effort:** 2 lines
- **Impact:** Critical — affects all 130 db pages, Google currently sees self-contradiction on the most content-rich pages
- **Files:** `src/pages/db/[slug].astro:70, 81`
- Append trailing slash to canonical URL + BreadcrumbList item

### 2. Add `lastmod` to sitemap
- **Effort:** 10 lines in `astro.config.mjs`
- **Impact:** High — without lastmod every URL looks equally stale to Google. Monthly-refreshing rankings will get faster recrawl.
- **Files:** `astro.config.mjs`

### 3. Add direct-answer prose summary above each ranking table
- **Effort:** ~20 lines, one place
- **Impact:** High — single most likely change to trigger Perplexity/ChatGPT citations
- **Files:** `src/pages/rankings/[slug].astro`, optionally `src/pages/rankings/index.astro`

### 4. Add `BreadcrumbList` JSON-LD to ranking pages
- **Effort:** ~15 lines
- **Impact:** High — completes the schema chain Google + AI systems expect
- **Files:** `src/pages/rankings/[slug].astro`, `src/pages/rankings/index.astro`

### 5. Demote header `<h1>GDB-Engines</h1>` to `<span>` everywhere
- **Effort:** ~5 lines + CSS check
- **Impact:** High — removes duplicate-h1 on every page using SiteHeader. Add a topical h1 (visible or `.sr-only`) on the homepage.
- **Files:** `src/components/SiteHeader.astro`, `src/pages/index.astro`

### 6. Update `90+` → `130+` in WebSite JSON-LD + default meta
- **Effort:** 2 lines
- **Impact:** Medium — stale signal across every page's JSON-LD
- **Files:** `src/layouts/Layout.astro:9, 17`

### 7. Set 1-year immutable cache on `/_astro/*` + `/fonts/*`
- **Effort:** 4 lines in `_headers`
- **Impact:** Medium (performance for return visitors), zero risk
- **Files:** `public/_headers`

### 8. Publish `/methodology/` page + add named maintainer attribution
- **Effort:** ~30 min writing
- **Impact:** High (E-E-A-T) — biggest content-side credibility gap
- **Files:** new `src/pages/methodology.astro`, link from `src/pages/about.astro` Rankings section + every ranking page footer

## Next month (medium-priority cluster)

### 9. Remove retired `Dataset` JSON-LD from homepage
- **Effort:** 5 lines
- **Files:** `src/pages/index.astro:76-98`

### 10. Add Content-Security-Policy header
- **Effort:** 1 line in `_headers`
- **Files:** `public/_headers`

### 11. HSTS `preload` directive + hstspreload.org submission
- **Effort:** 1-line change + external form
- **Blocked by:** Fixing `www` subdomain 525 (L5) first

### 12. Switch homepage `ItemList` URLs from vendor sites → `/db/{slug}/`
- **Effort:** ~10 lines in homepage index.astro
- **Impact:** Medium-high — fixes the schema-stitching chain AND drops nested SoftwareApplication blocks → significant HTML payload reduction (currently 830 KB uncompressed)
- **Files:** `src/pages/index.astro`

### 13. Rewrite homepage meta description
- **Effort:** 1 line
- **Files:** `src/layouts/Layout.astro:9`
- New: *"Compare 130+ graph databases side-by-side — features, licenses, query languages, and monthly popularity rankings. Data backed by academic research."*

### 14. Differentiate each ranking board's intro blurb
- **Effort:** Update `blurbFor` in `src/lib/ranking-boards.ts` to template more specifically (e.g. inject top engine + count + dominant license per board)
- **Impact:** Medium (anti-boilerplate signal)
- **Files:** `src/lib/ranking-boards.ts`

### 15. Add explicit AI-crawler allows to robots.txt
- **Effort:** ~8 lines appended
- **Files:** `public/robots.txt`

### 16. Drop `/llms.txt`
- **Effort:** 5 minutes
- **Impact:** Low-medium — small AI crawlers; major systems undeclared
- **Files:** new `public/llms.txt` (template in agent report 3)

## Backlog (low priority)

| # | Item | Files |
|---|---|---|
| L1 | IndexNow protocol — wire into monthly rankings update | rankings repo workflow |
| L2 | `og:site_name: GDB Engines` → `GDB-Engines` | `src/layouts/Layout.astro:48` |
| L3 | Versioned `og.png` URL + immutable cache | `public/_headers`, `Layout.astro` |
| L4 | Preload Rubik woff2 | `src/layouts/Layout.astro` |
| L5 | Fix `www` subdomain SSL 525 | Cloudflare dashboard |
| L6 | Schema on `/rankings/` index (covered by #4 BreadcrumbList) | covered |
| L7 | Tighten `/rankings/overall/` meta description to <160 chars | `src/lib/ranking-boards.ts` |
| L8 | `/db/falkordb/` → 301 → `/db/redisgraph-falkordb/` alias | redirect config |
| L9 | Reduce homepage HTML size (largely covered by #12) | covered |
| L10 | About page: separate `BreadcrumbList` block | `src/pages/about.astro` |

## After 30 days

Re-run audit with:
- `claude-seo:seo-drift` to compare against this baseline
- `claude-seo:seo-google` once GSC has impressions/clicks data on the new rankings URLs (CrUX field data will replace lab estimates)
- `claude-seo:seo-sxo` for page-type mismatch analysis on whichever rankings URLs are getting traffic
