# GDB-Engines SEO Audit — 2026-05-28

**Scope:** homepage + `/rankings/overall/` as representative pages. The other 30 ranking boards and 130 db pages share templates with these two URLs, so fixes propagate.

**Site:** Astro 5 static, Cloudflare Pages, 165 sitemap URLs. Just submitted to GSC.

---

## Health score: 63 / 100

| Category | Weight | Score | Weighted |
|---|---|---|---|
| Technical SEO | 22% | 72 | 15.8 |
| Content Quality (E-E-A-T) | 23% | 46 | 10.6 |
| On-Page SEO | 20% | 75 | 15.0 |
| Schema / Structured Data | 10% | 75 | 7.5 |
| Performance (lab-only, no CrUX) | 10% | 70 | 7.0 |
| AI Search Readiness | 10% | 31 | 3.1 |
| Images | 5% | 85 | 4.3 |
| **Total** | | | **63.3** |

**Tier:** *Good foundation, needs prioritized fixes.* The technical bones are solid (clean sitemap, valid schema, HTTPS, security headers, SSR JSON-LD). The two biggest opportunities are (1) AI-search citability and (2) E-E-A-T signals — both are content-and-attribution problems, not code.

---

## Critical issues (block correctness)

### C1. Canonical/trailing-slash split on every `/db/*` page

Every per-engine detail page (~130 of them) declares a canonical *without* a trailing slash, but is served *with* one and listed *with* one in the sitemap. Google sees a self-contradiction on the most content-rich pages of the site.

- Served at: `https://gdb-engines.com/db/neo4j/` → 200 OK
- Canonical: `https://gdb-engines.com/db/neo4j` (no slash)
- Sitemap: `https://gdb-engines.com/db/neo4j/` (slash)

**Fix** — `src/pages/db/[slug].astro` lines 70, 81: append trailing slash to both the canonical URL and the BreadcrumbList `item` field.

---

## High priority (significant impact, mostly small changes)

### H1. Sitemap has no `<lastmod>` on any URL

Crawlers can't prioritise recrawling updated pages. For monthly-refreshing rankings this is a wasted signal. Both the Technical and Sitemap auditors flagged this independently.

**Fix** — `astro.config.mjs`:

```js
import sitemap from '@astrojs/sitemap';
export default defineConfig({
  site: 'https://gdb-engines.com',
  integrations: [
    sitemap({
      serialize(item) {
        item.lastmod = new Date().toISOString().split('T')[0];
        if (item.url.includes('/rankings/')) {
          item.changefreq = 'monthly';
          item.priority = 0.8;
        } else if (item.url.includes('/db/')) {
          item.changefreq = 'yearly';
          item.priority = 0.6;
        }
        return item;
      },
    }),
  ],
});
```

### H2. Static assets served with 4-hour cache instead of 1-year immutable

`/_astro/*` (content-hashed JS/CSS) and `/fonts/*` (self-hosted woff2, 32–104 KB each) get `cache-control: public, max-age=14400, must-revalidate`. They never change at the same URL. Returning visitors re-validate every 4 hours on truly-immutable bytes.

**Fix** — add to `public/_headers`:

```
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/favicon*
  Cache-Control: public, max-age=31536000, immutable

/icon-*
  Cache-Control: public, max-age=31536000, immutable
```

### H3. Add a direct-answer prose paragraph to each ranking board (highest AI-citability win)

Today each ranking board jumps straight from H1 to a single boilerplate blurb to the table. Perplexity / ChatGPT can't easily extract a quotable answer for "best graph database for Rust" because there's no self-contained sentence with the answer + scores + date.

**Fix** — in `src/pages/rankings/[slug].astro`, above the `<RankingTable>`, render a 2-3 sentence summary. Source the values from `board.engines[0..2]`:

```astro
<p class="lead">
  As of {updated}, {board.engines[0].name} leads with a score of {board.engines[0].score.toFixed(1)},
  followed by {board.engines[1].name} ({board.engines[1].score.toFixed(1)}) and
  {board.engines[2].name} ({board.engines[2].score.toFixed(1)}). {board.engines.length} engines
  ranked across adoption, activity, community and research signals.
</p>
```

This is the single change most likely to trigger AI citations. Apply to the `/rankings/index.astro` page too with a top-3-overall summary.

### H4. Add `BreadcrumbList` JSON-LD to ranking pages

Visible breadcrumb exists; structured-data counterpart missing. Add to `src/pages/rankings/[slug].astro` after line 40:

```javascript
const breadcrumbJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gdb-engines.com' },
    { '@type': 'ListItem', position: 2, name: 'Rankings', item: 'https://gdb-engines.com/rankings/' },
    { '@type': 'ListItem', position: 3, name: board.h1, item: canonical },
  ],
});
```

Then pass `jsonLd={[itemListJsonLd, breadcrumbJsonLd]}` to `<Layout>`.

### H5. Duplicate `<h1>` on every page using `SiteHeader`

The header logo currently uses `<h1>GDB-Engines</h1>`. Page content (rankings, about, sponsor) also has an `<h1>`. Two h1s violates heading hierarchy and dilutes the topical signal. Same issue on the homepage where the h1 is just the brand name with no topical relevance.

**Fix** — `src/components/SiteHeader.astro` and `src/pages/index.astro` (header section): demote the brand h1 to a `<span class="header-brand">`. Style identically. On the homepage, add a visible or `.sr-only` content h1 like *"Graph Database Comparison — 130+ Engines"*.

### H6. Publish a real methodology page + name the maintainer

The current /about Rankings section says "drawing on public data sources across the web" — deliberately cagey, which was the user's choice for commercial reasons. But there's NO named author and NO scoring formula anywhere on the site. This is the single biggest E-E-A-T gap.

**Fix** — create `src/pages/methodology.astro`. Cover:

- Named maintainer (your name + handle + GitHub link)
- The four pillars with the actual signals fed into each (you can stay vague on weights if you want to protect IP, but list the *signals*: GitHub stars, npm/PyPI downloads, Stack Overflow tag counts, OpenAlex citations, Bluesky/HN buzz, job postings, Docker pulls, etc.)
- Cite the arXiv paper formally
- Link from About + every ranking page footer

You can keep the exact weights and the protocol-baseline cap proprietary; just publishing what's measured (not how) closes the credibility gap. Author attribution alone moves the E-E-A-T needle dramatically.

### H7. Stale "90+" count in WebSite JSON-LD and Layout default description

Site has 130 engines; meta says "90+". Appears in every page's JSON-LD.

**Fix** — `src/layouts/Layout.astro` lines 9 + 17: change `90+` → `130+`.

---

## Medium priority

### M1. Remove the homepage `Dataset` JSON-LD

`@type: Dataset` was retired from Google rich results in late 2025. Still parses, but adds payload for zero benefit. `src/pages/index.astro` lines 76–98: delete `datasetSchema`, change `jsonLd={[jsonLd, datasetSchema]}` → `jsonLd={[jsonLd]}`.

### M2. Add Content-Security-Policy header

All other security headers are present (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy). CSP missing.

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.seline.so; connect-src 'self' https://cdn.seline.so; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'
```

`'unsafe-inline'` for scripts is needed by the inline theme-detect block in `Layout.astro:71-73`. Replace with a nonce approach later to tighten.

### M3. HSTS `preload` directive

Current: `max-age=31536000; includeSubDomains`. Add `; preload`, fix the `www` 525 first, then submit at hstspreload.org. Forces HTTPS at the browser level, removing the HTTP→HTTPS round-trip entirely.

### M4. Switch homepage `ItemList` URLs from vendor sites → `/db/{slug}/`

Currently each ListItem `url` points to the engine's external site (neo4j.com, etc.). For Google's ranked list carousel to stitch with corroborating schema, point at our own `/db/{slug}/` page (which already has full `SoftwareApplication` schema). You can also drop the nested SoftwareApplication inside each ListItem if URLs target internal pages — major HTML payload reduction (the homepage is currently 830 KB uncompressed).

### M5. Homepage meta description is generic

Current (141 chars): *"A comprehensive list of 130+ graph databases, extensions, and query engines with feature comparison. Open Source data from academic research."*

Suggest (131 chars): *"Compare 130+ graph databases side-by-side — features, licenses, query languages, and monthly popularity rankings. Data backed by academic research."*

Update default in `src/layouts/Layout.astro` line 9.

### M6. Differentiate ranking board intros (currently a verbatim template across boards)

`/rankings/cypher/`, `/rankings/rust/`, `/rankings/gremlin/` — all share *"The best and most popular [X] graph databases, ranked monthly across adoption, activity, community and research signals."* Verbatim except the bracketed word. Google's duplicate-content classifier and AI systems both treat this as boilerplate. Combined with H3, write a 1-2 sentence category-specific intro per board (can be templated from data: top engine, count, dominant license/language).

### M7. Add explicit AI crawler allows to `robots.txt`

GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot currently rely on the implicit `User-agent: *` allow. Some AI systems preferentially crawl sites that explicitly welcome them. Append:

```
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /
```

Don't add `CCBot`/`anthropic-ai` blocks unless you specifically want to opt out of training (separate from search).

### M8. Drop `/llms.txt`

Small-AI-crawler hint, no proven impact on major AI search systems yet. Cheap to add, harmless. Template in the source agent report (`agent#3`).

### M9. Add `BreadcrumbList` to `/rankings/` index too

Same pattern as H4 but 2 levels (Home → Rankings). `src/pages/rankings/index.astro`.

---

## Low priority

- **L1.** IndexNow protocol not implemented. Drop `<key>.txt` in `public/`, POST URL list from your monthly rankings update script. Bing/Yandex/Naver only — not Google.
- **L2.** `og:site_name: GDB Engines` vs site brand `GDB-Engines` (missing hyphen). `src/layouts/Layout.astro` line 48.
- **L3.** `og.png` (206 KB) at 4-hour TTL. Either version-stamp the filename + add to immutable block, or accept the re-validate cost.
- **L4.** Preload hint for `rubik-latin.woff2` (104 KB body font, currently CSS-discovered). `<link rel="preload" href="/fonts/rubik-latin.woff2" as="font" type="font/woff2" crossorigin>` in `Layout.astro`.
- **L5.** `www.gdb-engines.com` returns Cloudflare SSL 525. Not linked anywhere, but typing it gives a hard error. Configure SSL cert for `www` or add a CNAME + redirect.
- **L6.** `/rankings/` index page has no schema beyond inherited WebSite. Add a `CollectionPage` or just rely on the BreadcrumbList from M9.
- **L7.** `/rankings/overall/` meta description is 169 chars — Google truncates around 155-160. Tightened version in the agent report.
- **L8.** Consider an alias `/db/falkordb/` → 301 → `/db/redisgraph-falkordb/` to capture brand-name searches that don't know about the legacy slug.
- **L9.** Homepage HTML is 830 KB uncompressed (~120 KB Brotli). Not a problem today; flag if mobile LCP degrades. Largely fixed by M4 (drop nested SoftwareApplication from homepage ItemList).
- **L10.** `/about` page uses `WebPage` with inline `breadcrumb` property. Valid but Google prefers a separate `BreadcrumbList` block.

---

## What's already good (don't touch)

- HTTP → HTTPS redirect (single hop, 301)
- Trailing-slash enforcement on rankings (308, single hop, correct)
- `<html lang="en">`, viewport meta, mobile-responsive
- HTTP/2 + Brotli compression
- 5 of 6 standard security headers
- `robots.txt` blocks faceted-search URL params (`?sort=`, `?features=`, etc.)
- Sitemap discoverable from robots.txt, all 165 URLs return 200, no orphans
- JSON-LD is server-rendered (not JS-injected) — correct per Dec 2025 Google guidance
- `ItemList` schema on rankings is clean (position + url + name on every item)
- `SoftwareApplication` schema on `/db/{slug}` pages — strong
- `set:html` JSON-LD escaping in Layout.astro — XSS-hardened correctly
- Internal linking density — homepage badges now linkify through to ranking boards; ranking pages link back to home + every engine
- Image alt text — decorative SVGs and DB favicons correctly use `alt=""` with text labels alongside
- Seline analytics loads `async`, no render blocking
- Per-page brand-styled OG images render at correct `/og/rankings/{slug}.png` URLs

---

## E-E-A-T scorecard

| Pillar | Score | Verdict |
|---|---|---|
| Experience | 11/25 | Moderate. Curates academic data + live signals. No documented first-hand testing or benchmark reproduction. |
| Expertise | 8/25 | Weak. No named author, no credentials, no surface-level affiliation. |
| Authoritativeness | 13/25 | Moderate-high potential. Comprehensive dataset, arXiv citation. No external coverage claims, no Wikipedia/Wikidata presence. |
| Trustworthiness | 14/25 | Reasonable. HTTPS, contact email, GitHub, sponsor-bias disclaimer. Missing privacy policy, named editorial responsibility. |
| **Total** | **46/100** | Methodology + named author (H6) is the single highest-leverage fix. |

---

## AI-citability scorecard (Perplexity / ChatGPT / AI Overviews)

| Dimension | Score |
|---|---|
| Passage-level citability | 5/25 — table-only, no prose framing |
| Structural readability | 8/20 — SSR + clean tables, but no question-headings or FAQ |
| Authority/brand signals | 8/20 — arXiv good; no Wikipedia, no author |
| Technical accessibility | 7/20 — JSON-LD present; no llms.txt, no explicit AI-crawler allow |
| Multi-modal | 3/15 — no charts/infographics on ranking pages |
| **Total** | **31/100** |

H3 (direct-answer paragraph) + H6 (named methodology) + M7 (AI crawlers) move this to ~60.

---

## Notes

- One subagent flagged "No schema.org JSON-LD detected" which is **incorrect** — `WebSite` + `ItemList` (+ `Dataset` on homepage) are present and SSR'd. The schema-focused agent confirmed this directly. Trust the schema agent.
- Performance was assessed lab-only (no CrUX/GSC API access in this session). Once GSC has 25+ weeks of CrUX data on the new rankings URLs, re-run with `claude-seo:seo-google` for real Core Web Vitals field data.
- A second audit pass in ~30 days will give Drift + GSC field data to compare against.
