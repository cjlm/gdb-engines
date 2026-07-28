# Comparison pages — design

Status: proposed. Not committed. Working file.

Two new indexable surfaces:

- **Pair pages** (`Neo4j vs Memgraph`) — the combinatorial surface, pre-generated from a
  popularity-weighted subset, capturing "X vs Y" demand.
- **Roundup pages** (`Embedded graph databases compared`) — a small curated set of
  multi-way comparisons over catalogue segments, capturing "best X" / "X compared" demand.

Plus a noindex client-side builder for everything else. This document resolves the
pre-generated vs dynamic question, draws the line between roundups and the existing
ranking boards, and specifies the pages, the add-database combobox, the internal linking,
and a phased build.

Three-way and larger *combinatorics* are explicitly out of scope. Multi-way coverage comes
from the curated roundups, not from `C(143,3)`.

---

## 0. Ground truth this design is built on

Read from the repo before designing, not assumed:

| Fact | Source |
|---|---|
| Astro 5.17, `output: 'static'`, `trailingSlash: 'always'`, `site: https://gdb-engines.com` | `astro.config.mjs` |
| Deployed to Cloudflare Pages via a deploy hook, triggered by `repository_dispatch` from the rankings repo | `.github/workflows/rebuild-on-rankings-update.yml` |
| 143 engine TOMLs in a content collection with a Zod schema | `src/content/databases/*.toml`, `src/content.config.ts` |
| Fields available: `name, vendor, slug, description, url, github_url, license, implementation_language, type, kind, category, status, status_note, previous_vendors, previous_names, released, query_languages, icon, gdotv_support, gdotv_url, features{43 keys, 0–1}` | schema |
| `features` is **optional**, and only **53 of 143** engines have a `[features]` block. Among the top 24 ranked, 14; among the top 40, 23 | counted across `src/content/databases/*.toml` |
| Existing ranking boards are generated for every value of `type`, `kind`, `license` tier, `query_languages` and `implementation_language`, plus `overall` and `movers` — roughly 30 boards at `/rankings/<slug>/` | `src/lib/ranking-boards.ts` `buildBoards()` |
| Ranking board titles follow `{label} Graph Database Popularity Ranking` (via `gdbRankingTitle`), or `{label} Popularity Ranking` for `kind` boards | `src/lib/ranking-boards.ts` |
| Analytics is **Seline**, loaded in `Layout.astro` from the first-party proxy `sln.gdb-engines.com`, gated on `PUBLIC_SELINE_TOKEN`. CSP already permits `script-src` and `connect-src` to that host | `src/layouts/Layout.astro`, `public/_headers` |
| Favicons are already solved: `scripts/extract-favicons.mjs` runs on `prebuild`, writes `public/logos/<slug>.png` (32px), sourcing Google s2 → GitHub org avatar, and byte-compares against the known generic and GitHub icons to reject placeholders | `scripts/extract-favicons.mjs`, `src/utils/favicon.ts` |
| Rankings come from the private `cjlm/gdb-engines-rankings` repo (`out/ranking.json`) via the GitHub contents API with `RANKINGS_TOKEN`, sibling-checkout fallback for dev. Site builds fine without it | `src/lib/rankings.ts` |
| `RankedEngine` exposes `score, tier, momentum, coverage, pillars{popularity,activity,community,research}, rankDelta1m`. **There is no rank history array** | `src/lib/rankings.ts` |
| The rankings repo *does* keep monthly snapshots (`history/ranking-2026-05-28.json` … `2026-07-01.json` — 4 months) but the site never reads them | `../gdb-engines-rankings/history/` |
| 136 engines appear on the overall board; 135 have a real tier (1 is `Insufficient data`). 7 catalogue engines are unranked | computed from `out/ranking.json` |
| Sponsors load the same way from the private repo, keyed by **board slug**, with an `expires` date | `src/lib/sponsors.ts`, `src/components/SponsorSlot.astro` |
| `/api.json` exposes `slug, name, description, url, type, category, released, gdotv_support, features` — the full feature blocks make it heavy | `src/pages/api.json.ts` |
| `404.astro` exists specifically so Cloudflare Pages returns a real 404 instead of a soft-404 copy of the homepage | `src/pages/404.astro` |
| `robots.txt` already disallows the homepage's query-param states (`?sort=`, `?search=`, `?features=`, `?inactive=`) | `public/robots.txt` |
| Rankings pages already ship a data-derived "direct answer" summary paragraph and `ItemList` + `BreadcrumbList` JSON-LD | `src/pages/rankings/[slug].astro` |
| **Agent-readiness does not exist in this repo.** It is designed and partly measured in the private repo (`docs/agent-readiness/`), with a provisioning tier T0–T4 plus 8 dimensions scored 0–5. Nothing is wired into the site | grep across `gdb-engines` returns zero hits |

### 0.1 How the catalogue actually segments

Counted across all 143 TOMLs (not estimated). This is what the roundup list in §3 is built
from, and it rules several obvious slices out.

| Field | Distribution |
|---|---|
| `type` | Property Graph 70 · RDF 35 · Other 21 · Multiple 17 |
| `kind` | database 95 (89 defaulted + 6 explicit) · embedded 22 · extension 10 · query-engine 9 · library 7 |
| `category` | Emerging 80 · Enterprise 27 · Established 24 · Growing 12 |
| `status` | active 104 · inactive 33 · deprecated 6 |
| `license` | Apache-2.0 42 · Proprietary 40 · MIT 20 · BSD-3 8 · GPL-3.0 5 · then a long tail of 1–4 |
| `implementation_language` | C++ 34 · Java 32 · Rust 22 · C 11 · then ≤4 each |
| `query_languages` | SPARQL 39 · openCypher 34 · Gremlin 23 · SQL 17 · Custom API 16 · GraphQL 14 · GQL 13 · Cypher 10 · SQL/PGQ 6 |
| `gdotv_support` | 35 true |

Three things follow directly:

- **No useful segment is small enough for a pure column layout.** Restricted to active
  engines, candidate slices run from 5 (`library`) to 48 (Cypher-family). Every roundup
  needs the columns-plus-table treatment in §3.3; there is no "just show them all as
  columns" case.
- **Roundups cannot lean on the survey feature matrix.** Feature coverage inside slices is
  sparse and uneven: embedded 2 of 15, library 0 of 5, RDF 6 of 19, Cypher-family 14 of 48.
  The fields that *are* near-universal — license, implementation language, query languages,
  released, kind, category, status, rank — have to carry the comparison, with the feature
  matrix shown only where coverage supports it.
- **The long tails are junk slices.** Licenses and implementation languages below the top
  four have 1–4 members each. Generating a roundup per field value would manufacture
  exactly the index bloat §1 exists to avoid. Hence the curated list in §3.2.

Two further consequences worth stating up front, because they change the deliverable:

1. **A popularity sparkline is not currently buildable.** `ranking.json` carries
   `rankDelta1m` and nothing else historical. Rendering a sparkline requires an upstream
   change to the rankings generator (see §8). Phase 1 ships the rank plus the 1-month
   delta, using the exact `▲/▼/=/new` vocabulary already in `RankingTable.astro`.
2. **The agent-readiness row group is a slot, not content.** The page reserves and
   specifies it so it can be dropped in unchanged, but it renders nothing until the index
   ships.

---

## 1. URL and generation strategy

### 1.1 The question

143 engines → `C(143,2)` = **10,153** pairs. Pre-generating all of them is possible in a
static build. The question is whether it is a good idea.

### 1.2 Options considered

**A. Pre-generate all 10,153 pairs.**
Maximum long-tail surface. Costs:

- Cloudflare Pages caps a deployment at **20,000 files**. Current output is roughly 340
  files (143 engine pages + ~40 ranking boards + ~40 ranking OG images + 143 logos +
  assets). 10,153 comparison pages take it to ~10,500 — survivable alone, but it consumes
  half the budget permanently and makes per-pair OG images (another 10,153 files)
  impossible without breaching the cap.
- Build time. Every page is a directory with an `index.html` under `trailingSlash:
  'always'`; 10k Astro renders plus 10k directory writes is minutes, on every deploy,
  including the monthly rankings rebuild.
- The real cost is SEO, not infrastructure. A site with ~500 visitors/month has a small
  crawl allocation. Publishing 10k pages of which ~9,800 have zero query demand
  ("StromaDB vs NeuG") is textbook index bloat: it spends the crawl budget on pages that
  will never rank, and the near-duplicate template across 10k URLs is precisely the
  signal Google's site-wide quality systems act on. The downside risk is not "those pages
  don't rank" — it is that they drag the 200 pages that would have.

**B. Fully dynamic — one `/compare/` page, everything client-side.**
Zero index bloat, zero build cost. Also zero SEO capture, which is the entire point of
the feature. A query-param URL rendered by JS is at best weakly indexed and cannot be
targeted with a title, an H1, or a description. Rejected on the goal.

**C. Popularity-weighted pre-generation, with everything else resolving to a noindex
client-side builder. ← recommended**

### 1.3 Recommendation

**Pre-generate a popularity-weighted subset as static, indexable pages; resolve every
other combination on a single noindex client-side builder.** Search demand for "X vs Y"
follows the popularity distribution almost exactly, so a few hundred pages capture nearly
all of the available traffic while the remaining ~8,400 pairs stay out of the index
entirely — the long tail still *works* for a visitor, it just isn't published.

**Selection rule** (computed at build time from `ranking.overall`, excluding
`Insufficient data`):

- **Set A — all pairs among the top 40 by overall rank.** `C(40,2)` = **780 pages.**
  Covers every plausible peer-vs-peer query.
- **Set B — each of the top 10 engines paired with every one of the 143 catalogue
  engines.** Captures the asymmetric long tail, which is real: people search "Neo4j vs
  \<obscure\>" but never "\<obscure\> vs \<obscure\>". **1,375 pages.**
- **Union: 1,810 pages.**
- **Minus the feature-coverage gate below: 1,455 pages.** (All figures computed against the
  live `ranking.json` and the TOMLs, not estimated.)

**Feature-coverage gate.** Only 53 of 143 engines carry a `[features]` block, so of the
1,810 union pairs, 463 have survey data on both sides, 1,455 on at least one, and **355 on
neither**. A pair where neither engine was surveyed reduces to identity plus a handful of
catalogue fields — genuinely thin, and thin at scale is the failure mode this whole section
is guarding against. Drop them: require at least one side to have been surveyed. The set
becomes 1,455 pages, and the 355 excluded pairs still resolve through the builder (§1.4)
like any other unlisted combination.

All three thresholds — `peerDepth`, `anchorDepth`, and the coverage gate — are constants in
one module. If Search Console shows impressions piling up at the boundary, raise 40 → 60
(`C(60,2)` = 1,770, union ≈ 2,800) and rebuild. If the pages underperform, lower them.
Nothing else in the design changes.

Total deployment files after this: ~1,850, plus the roundups in §3. Comfortably inside the
Pages cap, with room for per-pair OG images later if they earn it.

### 1.4 URL scheme

| URL | Surface | Count | Indexed |
|---|---|---|---|
| `/compare/` | Hub — roundup directory, curated pairs, the builder | 1 | yes |
| `/compare/<a>-vs-<b>/` | Pair page, `a < b` alphabetically | 1,455 | yes |
| `/compare/<editorial-slug>/` | Curated roundup (§3) | 10–25 | yes |
| `/compare/custom/?db=x&db=y&db=z` | Client-side builder, 2–4 columns | 1 | **no** — `noindex, follow` |

Pair slugs and roundup slugs share the `/compare/` namespace. They cannot collide: every
pair slug contains the token `-vs-` and the build rejects any roundup slug containing it
(§3.2). One assertion, checked at build time.

**Canonicalisation.** The slug pair is sorted alphabetically, always:
`/compare/memgraph-vs-neo4j/`, never `/compare/neo4j-vs-memgraph/`. One URL per pair, no
duplicate-content pair, self-canonical. Slugs come straight from the TOML `slug` field,
which the schema already constrains to `^[a-z0-9-]+$`, so no escaping is needed. Existing
slugs contain `-` but none contain the literal token `-vs-`, so parsing by splitting on
`-vs-` is unambiguous; the build asserts this and fails loudly if a future slug breaks it.

**Unmatched pair URLs** (reverse order, or a pair outside the pre-generated set). A
`_redirects` splat (`/compare/:pair/ → /compare/custom/?pair=:pair 302`) was the first
choice, on the belief that Cloudflare Pages serves a matching static asset in preference
to a `_redirects` rule. **Preview-deploy verification (2026-07-28) disproved that**: the
splat fired before assets, 302ing every pre-generated pair, every roundup, and the builder
itself (in a loop, since `custom` matches `:pair`). The splat is gone; the shipped
mechanism is the fallback:

`404.astro` returns a real 404 and carries a small inline script that recognises a
`/compare/<a>-vs-<b>/` path and `location.replace()`s to `/compare/custom/?pair=…`. The
status stays 404 (correct — we do not want it indexed) and the visitor still lands on a
working comparison.

Because the forward is untyped it also carries genuine typos. The builder therefore
validates `?pair=`: it must split on `-vs-` into exactly two known slugs. Anything else
renders the builder's empty state — `Pick two databases to compare.` — rather than an
error.

**Reverse-order and near-miss recovery.** `/compare/custom/` ships with the pre-generated
manifest (§4.1). On load it sorts the requested slugs; if the sorted pair is in the
manifest it immediately `location.replace()`s to the canonical pre-generated URL, so a
visitor who typed the pair backwards lands on the fast, indexable page.

### 1.5 Three or more databases

Three-column selections stay **client-side and noindex**: `/compare/custom/?db=a&db=b&db=c`.

Reasoning: `C(143,3)` is 470,000 — pre-generation is not on the table, and triple query
demand is thin and concentrated in a handful of well-known trios. The builder handles any
selection from 2 to 4 columns identically, so there is no functional gap.

**Multi-way search demand is served by the curated roundups in §3 instead.** That is the
deliberate trade: "compare more than two graph databases" is a real intent, but it is
almost never expressed as three named engines. It is expressed as a segment — "best
embedded graph database", "open source Cypher databases", "RDF triplestores compared". A
segment page answers that intent better than a triple page would, and there are 15 of them
rather than 470,000.

If Search Console later shows demand for a *specific* named triple, add it to the same
curated list at `/compare/<a>-vs-<b>-vs-<c>/`, rendered by the same component with the same
alphabetical rule. Curated, not combinatorial. Deferred; not built speculatively.

### 1.6 Sitemap

`@astrojs/sitemap` picks up static pages automatically, so the 1,455 pair pages, the 14
roundups and the hub are included with no work. Two changes to `astro.config.mjs`:

- `filter:` exclude `/compare/custom/`. It is noindex; listing a noindex URL in a sitemap
  is a contradictory signal.
- `serialize:` add a `/compare/` branch, splitting on whether the slug contains `-vs-`:

  | | `lastmod` | `changefreq` | `priority` |
  |---|---|---|---|
  | Pair page | `max(dbDates[a], dbDates[b], buildDate)` | `monthly` | 0.5 |
  | Roundup | `max(dbDates[…members], roundupTomlDate, buildDate)` | `monthly` | **0.7** |
  | `/compare/` hub | `gitDate` of the hub page | `weekly` | 0.8 |

  `buildDate` is honest for both because the rank block regenerates monthly — the same
  reasoning `/rankings/*` already uses. Roundups sit at 0.7, above pair pages (0.5) and
  engine pages (0.6): there are 14 of them, they are hand-maintained, and they are the
  pages this design most wants crawled promptly. Pair pages sit lowest by design — they
  are numerous and individually low-value.

At ~1,900 total URLs the sitemap stays in a single `sitemap-0.xml`; the existing
`/sitemap.xml → /sitemap-index.xml` redirect keeps working.

**Do not add `/compare/custom/` to `robots.txt`.** A `Disallow` would prevent Google from
ever reading the `noindex`, which is the opposite of the intent. Crawlable and noindexed
is the correct combination.

### 1.7 Build pipeline changes

New module `src/lib/comparisons.ts`:

```ts
export interface Pair { a: string; b: string; slug: string }   // slug = `${a}-vs-${b}`, a<b
export function selectPairs(ranking: RankingFile | null, databases: Db[], opts?: {
  peerDepth?: number;    // default 40 — all-pairs among the top N
  anchorDepth?: number;  // default 10 — top M paired against the whole catalogue
  requireSurveyed?: boolean; // default true — drop pairs where neither side has [features]
}): Pair[]
export function isPregenerated(slug: string): boolean

/** Members of a roundup, filter applied, include/exclude honoured, rank-ordered. */
export function resolveRoundup(def: RoundupDef, databases: Db[], ranking: RankingFile | null): {
  members: Db[];          // active, ordered by overall rank
  columns: Db[];          // members.slice(0, 6)
  inactive: Db[];         // filtered-out inactive/deprecated, for the footnote (§3.2)
  surveyedCount: number;  // decides whether the feature matrix renders (§3.4)
}
```

When `ranking` is `null` (no `RANKINGS_TOKEN`, no sibling checkout) `selectPairs` returns
a small static seed list of ~20 well-known pairs, and `resolveRoundup` orders members
alphabetically instead of by rank. Roundups still build — they are defined by catalogue
fields, not by ranking data. This mirrors how the site already degrades without rankings.

Roundup definitions load as a second content collection in `src/content.config.ts`,
alongside `databases`, with the Zod schema in §3.2:

```ts
const roundups = defineCollection({
  loader: glob({ pattern: '**/*.toml', base: './src/content/roundups' }),
  schema: z.object({ /* slug, title, h1, lede, filter, include, exclude, ranking_board */ }),
});
export const collections = { databases, roundups };
```

`src/pages/compare/[pair].astro` follows the pattern already established in
`src/pages/rankings/[slug].astro`: **all shared data is assembled once inside
`getStaticPaths` and passed through `props`.** This matters at 1,455 pages — the naive
version calls `fetchFavicon` and `getCollection` per page and turns a 30-second build into
a multi-minute one. Assemble once:

```ts
export async function getStaticPaths() {
  const [ranking, sponsors, databases] = await Promise.all([...]);
  const byslug     = new Map(databases.map(d => [d.data.slug, d.data]));
  const faviconMap = await buildFaviconMap(databases);   // one pass, 143 lookups
  const linkMaps   = ranking ? buildLinkMaps(ranking) : null;
  const rankMap    = ranking ? buildOverallRankMap(ranking) : null;
  const sponsor    = getSponsor(sponsors, 'compare');
  return selectPairs(ranking, databases).map(p => ({
    params: { pair: p.slug },
    props:  { a: byslug.get(p.a)!, b: byslug.get(p.b)!, faviconMap, linkMaps, rankMap, sponsor, generatedAt: ranking?.generatedAt },
  }));
}
```

`buildFaviconMap` is a small extraction of the identical loop currently duplicated in
`index.astro`, `db/[slug].astro`, and `rankings/[slug].astro` — three copies is the
threshold, and a fourth consumer is the reason to lift it into `src/lib/favicon-map.ts`.
This is the only refactor the feature justifies.

`src/pages/compare/[roundup].astro` shares that hoisted data via the same pattern. Because
pair slugs and roundup slugs live in one namespace, **both routes cannot be separate
`[param]` files** — Astro would see two dynamic routes at the same depth. Use a single
`src/pages/compare/[entry].astro` whose `getStaticPaths` returns both sets, tagging each
with `props.kind: 'pair' | 'roundup'`, and branch once at the top of the template. One
route, one namespace, no collision possible by construction.

No deployment change. `output: 'static'` stays, Cloudflare Pages stays, the monthly
`repository_dispatch` rebuild regenerates pair pages and roundups with fresh ranks for
free.

---

## 2. Page anatomy

### 2.1 Visual direction

The brief is to match the site, so the existing tokens win outright — no new colours, no
new typefaces, no new radii. Everything below is drawn from `src/styles/global.css`.

- **Type.** `Familjen Grotesk` 600, uppercase, `letter-spacing: -0.5px` for row-group
  labels — the same treatment as `.header-brand`. `Rubik` for body and row labels. **`IBM
  Plex Mono` for every numeral on the page** — ranks, scores, years, deltas — with
  `font-variant-numeric: tabular-nums` so columns align optically. The mono face is
  already loaded and this is the first page where the data volume earns it.
- **Colour.** `--color-border` hairlines, `--color-surface` for the sticky header band,
  `--color-text-tertiary` for unassessed cells, existing badge classes
  (`badge-established`, `badge-enterprise`, `badge-growing`, `badge-emerging`,
  `badge-property-graph`, `badge-rdf`, …) reused verbatim for type, category and tier.
- **`--color-brand-accent` appears in exactly one place on this page**: the difference
  rule, below. Spending the accent once is what keeps a 43-row matrix from reading as
  decoration.

**Signature element — the difference rule.** Every row where the compared engines
*differ* carries a 2px `--color-brand-accent` rule in the left gutter. Rows where they
agree carry nothing. Scrolling the feature matrix, the left edge becomes a dashed vertical
rhythm that *is* the difference profile — the page's texture answers the question the
visitor actually typed. This is structure encoding content, and it costs one CSS class.
It pairs with a count above the matrix: `11 of 43 rows differ`.

**Sticky engine headers.** The column header is a compact engine card (favicon, name, rank
chip) pinned at `position: sticky; top: var(--header-height)`. A 43-row comparison is
unusable once the headers scroll away. Practical, not ornamental.

**Motion.** Effectively none — a 120ms opacity/width collapse when a column is removed,
matching the 120ms transitions already in `SponsorSlot.astro`, wrapped in
`prefers-reduced-motion: no-preference`.

### 2.2 Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [header: logo / Compare 143 graph databases / Rankings]  [⌘K] [☾] [≡]│
├──────────────────────────────────────────────────────────────────────┤
│ ← Back to comparison                                                 │
│                                                                      │
│ Neo4j vs Memgraph                                    ← h1            │
│ Both are property graph databases queried with Cypher. Neo4j (2007,  │
│ GPL-3.0, Java) ranks #1 this month; Memgraph (2017, BSL-1.1, C++)    │
│ ranks #6. They differ on 11 of 43 surveyed features.   ← §2.4        │
│                                                                      │
│    ┌───────────────┬──────────────────┬──────────────────┐           │
│ ▓▓ │               │ ◉ Neo4j          │ ◉ Memgraph       │  ⊕ Add    │  sticky
│ ▓▓ │               │ #1  = Leader     │ #6  ▲2  Strong   │           │  header
│    ├───────────────┼──────────────────┼──────────────────┤           │
│    │ AT A GLANCE                                          │          │
│  │ │ Rank            #1                 #6                │          │  ← difference
│    │ Tier            Leader             Strong            │          │    rule in
│  │ │ Score           83.6               71.2              │          │    the gutter
│    ├───────────────┼──────────────────┼──────────────────┤           │
│    │ FUNDAMENTALS                                         │          │
│    │ Model           Property Graph     Property Graph    │          │
│  │ │ License         GPL-3.0            BSL-1.1           │          │
│  │ │ Written in      Java               C++               │          │
│    │ Query languages Cypher, GQL        Cypher, GQL       │          │
│    ├──────────────────────────────────────────────────────┤          │
│    │ [Sponsored ─ …]                                      │          │
│    ├──────────────────────────────────────────────────────┤          │
│    │ FEATURE SCORES          11 of 43 rows differ  [⚑ only│differing] │
│    │  Deployment                                          │          │
│  │ │   In-memory testing  ✓                 ·             │          │
│    │   Containerization   ✓                 ✓             │          │
│    │   …                                                  │          │
│    ├──────────────────────────────────────────────────────┤          │
│    │ LINKS  website · github · full profile               │          │
│    └──────────────────────────────────────────────────────┘          │
│                                                                      │
│ Related comparisons  · Neo4j vs ArangoDB · Memgraph vs FalkorDB …    │
└──────────────────────────────────────────────────────────────────────┘
```

The row-label column is `position: sticky; left: 0` so it survives the horizontal scroll
the site already uses for wide tables.

### 2.3 Row groups, in order

1. **Identity** — favicon, name, vendor, description. In the sticky header for name and
   favicon; vendor and description as the first two rows.
2. **At a glance** — overall rank, 1-month delta (`▲2` / `▼1` / `=` / `new`, reusing
   `fmtDelta`/`deltaClass` from `RankingTable.astro`), tier badge, blended score, and the
   four pillar scores (popularity / activity / community / research). Every value links to
   the board it came from. `— Not ranked` for unranked engines, never `#—`.
3. **Fundamentals** — model type, kind, category, first released, status (+ `status_note`
   when not active), license, implementation language, query languages, gdotv support.
4. **Sponsor slot** — see §2.6.
5. **Feature scores** — all 43, in the existing `featureGroups` order from
   `src/data/feature-metadata.ts`, with `featureDisplayNames` as row labels and
   `featureDescriptions` on the existing microtip tooltip. Differing rows carry the
   difference rule. A `Show only differing rows` toggle filters to them (default off, so
   the crawler sees the full matrix in the HTML).
6. **Agent readiness** — *slot only, renders nothing until the index ships.* When it does:
   its own section under its own `<h2>`, visually separated by a full-width rule, with the
   provisioning tier as a badge and the 8 dimensions as their own sub-matrix. It carries a
   standing note that it is an editorial assessment produced by running each database's
   onboarding, distinct from the mechanical rankings above. **No sponsor slot may be
   placed inside this section or in the two blocks adjacent to it.**
7. **Links** — official website (with the existing `utm_source=gdb-engines&utm_medium=referral`
   parameters), GitHub, and the `/db/<slug>/` profile page.
8. **Related comparisons** — §5.

### 2.4 Missing data and ties

The catalogue's `features` block is optional and its scores are graded, so the rendering
has to distinguish three states the homepage currently collapses into one:

| State | Render | Tooltip |
|---|---|---|
| `1.0` | `✓` | the `scoreMeanings` string |
| `0.5` / `0.75` / `0.25` | half-filled bar, reusing `.bar-indicator` | the `scoreMeanings` string |
| `0` — assessed, absent | `·` muted middot | the `scoreMeanings` string |
| field absent | `—` in `--color-text-tertiary` | `Not assessed` |

`0` and *not assessed* are different claims and must not look alike. If an engine has no
`features` block at all, the feature matrix renders its column as a full band of `—`, the
difference count is suppressed, and the header reads `Feature scores — not surveyed for
Memgraph` rather than a misleading `43 of 43 rows differ`.

**Ties get no treatment.** Where values are equal the row is simply unmarked — that is the
difference rule doing its job.

**There is no winner.** No "overall winner" badge, no per-row green/red, no aggregate
"Neo4j scores 38/43". Summing 0–1 survey scores into a verdict would be arithmetic
dressed as judgement, from a source (Coimbra et al. 2025) that never intended it, and it
is the single visual cue that separates a reference site from affiliate comparison slop.
The page presents the difference and stops.

### 2.5 Prose

**Position: no generated prose paragraphs. A deterministic fact summary instead.**

Templated narrative at 1,455-page scale is exactly what Google's helpful-content systems
demote, and it would be the first text on this site that is not directly derived from
data. The risk is not that it fails to help — it is that it costs the credibility the
site trades on.

What ships instead is one to three sentences assembled from fields, with no adjectives and
no recommendation. The site already does this: `rankings/[slug].astro` builds a
"direct-answer summary" from the top three engines. Same move, per pair:

> Both are property graph databases queried with Cypher. Neo4j (2007, GPL-3.0, Java)
> ranks #1 overall this month; Memgraph (2017, BSL-1.1, C++) ranks #6. They differ on 11
> of 43 surveyed features.

Every clause is a field lookup. It is unique per pair because the underlying facts are,
it answers the query in the first sentence, and it is quotable by an AI summariser — which
matters more than SERP snippet length at this traffic level.

Below it, a **Key differences** list of at most five bullets, generated only where one
engine scores `1.0` and the other `0` — an unambiguous presence/absence difference, not a
graded one:

> - Only Memgraph offers an in-memory testing version.
> - Only Neo4j provides an object-graph mapper.

Where fewer than two such rows exist the block is omitted rather than padded. No `FAQPage`
markup on it — it is not a Q&A and marking it as one is fabrication.

### 2.6 Sponsors

Comparison pages are a mechanical surface (rank + survey scores + catalogue fields), so
one `SponsorSlot` is fine. Two rules:

1. **Placement** — a single slot between Fundamentals and Feature scores. Never inside or
   adjacent to the agent-readiness section, per the standing monetisation rule.
2. **Keying** — `getSponsor(sponsors, 'compare')`, a single site-wide comparison sponsor,
   **not** keyed to the engines in the columns. A vendor's ad appearing on its own
   head-to-head page reads as paid influence over the comparison whether or not it is. The
   component additionally suppresses the slot when the sponsor's `engine_slug` matches
   either column, which requires adding an optional `engine_slug` field to the `Sponsor`
   interface in `src/lib/sponsors.ts`.

---

## 3. Curated roundup pages

The multi-way surface. Pair pages scale combinatorially and are chosen by an algorithm;
roundups do not scale and are chosen by hand. That is the point — they are the editorial
counterweight that keeps multi-way coverage from becoming an index-bloat problem.

### 3.1 The line against the existing ranking boards

This is the constraint that shapes everything else in this section. `buildBoards()` already
emits ~30 boards at `/rankings/<slug>/`, covering every value of `type`, `kind`, `license`
tier, `query_languages` and `implementation_language`. A roundup on "embedded graph
databases" is therefore competing with `/rankings/embedded/` unless the split is deliberate.

**The split is by intent, and it is clean:**

| | Ranking board | Roundup |
|---|---|---|
| Question | *Which is most popular in segment X?* | *How do the databases in segment X compare?* |
| Content | One ranked list, ordered by blended score | Multi-column attribute comparison, ordered by rank |
| Source | Mechanical monthly scores | Catalogue fields + survey scores |
| Query shape | "most popular X", "top X", "X ranking" | "best X", "X compared", "X alternatives" |
| Changes | Monthly | Only when the catalogue changes |
| Verdict | Implicit ordering | None (§2.4 applies) |

The boards already claim the *popularity* vocabulary — their titles are literally
`{label} Graph Database Popularity Ranking` and their blurbs already use "most popular",
"best", "top". Roundups must not reuse that vocabulary. Concretely:

- **Roundup titles never contain "ranking", "popularity", "top", or "most popular".** They
  use `Compared`, `Comparison`, or `Alternatives`.
- **Board titles are unchanged.** No edits to `ranking-boards.ts` copy; this design does
  not get to reshape an existing ranked surface to make room for a new one.
- **Every roundup that has a corresponding board links to it, and vice versa**, with
  reciprocal anchors that state the difference rather than repeating the keyword:
  - on the roundup: `Ranked by popularity: Embedded Popularity Ranking →`
  - on the board: `Compare these side by side: Embedded graph databases compared →`

  The board link is added once in `rankings/[slug].astro`, keyed by a
  `rankingBoardSlug` field on the roundup definition, so only boards with a roundup get a
  link and there is no orphan reference.

Where a segment has no board — anything crossing two fields, like *open-source Cypher
databases* — the roundup stands alone and the collision question does not arise. These
combination slices are the most defensible roundups for exactly that reason, and the
curated list leans on them.

### 3.2 Definition mechanism

**A hand-maintained TOML file, not derived from every field value.** Auto-generating a
roundup per field value would produce ~60 pages, most of them junk slices with 1–4 members
(§0.1) — reintroducing the bloat problem in a new place.

`src/content/roundups/*.toml`, loaded as a second Astro content collection with its own
Zod schema so bad entries fail the build rather than shipping:

```toml
slug = "open-source-cypher-databases"
title = "Open Source Cypher Graph Databases Compared"
h1 = "Open source Cypher graph databases compared"
lede = "Graph databases that speak Cypher or openCypher under a non-proprietary license."
# Which catalogue engines belong. All conditions AND together; list values are OR.
[filter]
query_languages = ["Cypher", "openCypher"]
license_not = ["Proprietary"]
status = ["active"]
# Optional hand corrections on top of the filter.
include = []            # force-add a slug the filter misses
exclude = []            # drop a slug that technically matches but misleads
ranking_board = ""      # slug of the corresponding /rankings/ board, if any
```

Schema rules, all enforced at build time:

- `slug` must not contain `-vs-` (namespace safety, §1.4) and must be unique against both
  the pair set and the other roundups.
- **Minimum 6 active members after filtering.** Below that the page is thinner than the
  engine detail pages it links to, and it is a better `include` list on an existing
  roundup. This gate is what excludes `kind = "library"` (5 active members, 0 surveyed).
- Every slug in `include`/`exclude` must exist in the catalogue — a typo fails the build,
  it does not silently do nothing.
- `ranking_board`, if set, must match a real board slug.

Member ordering is by overall rank, unranked last, alphabetically within that — the same
rule the homepage already uses.

**Deprecated and inactive members get a footnote, not silent omission.** The filter is
active-only, which is right, but it produces traps: an *embedded graph databases* roundup
built today omits **Kùzu** — plausibly the single most-searched embedded graph database —
because it was archived in October 2025 after the Apple acquisition and forked into
LadybugDB and Bighorn. A reader who does not know that sees a page that looks wrong. So
each roundup renders a short `No longer active` block listing filtered-out
inactive/deprecated members with their existing `status_note`, each linking to its
`/db/<slug>/` page. The field is already populated and this is the first surface that
needs it.

### 3.3 The starting list

Fourteen roundups, every count computed from the live catalogue restricted to active
engines. `surveyed` is how many members carry a `[features]` block — it decides whether the
feature matrix renders (§3.4).

| Slug | Members | Surveyed | Corresponding board |
|---|---|---|---|
| `open-source-graph-databases` | 72 | 19 | — (spans license tiers) |
| `open-source-cypher-databases` | 29 | 7 | — |
| `cpp-graph-databases` | 25 | 9 | `/rankings/cpp/` |
| `rust-graph-databases` | 22 | 3 | `/rankings/rust/` |
| `enterprise-graph-platforms` | 21 | 13 | — |
| `established-graph-databases` | 20 | 11 | — |
| `rdf-triplestores` | 19 | 6 | `/rankings/rdf/` |
| `java-graph-databases` | 18 | 10 | `/rankings/java/` |
| `gremlin-graph-databases` | 17 | 7 | `/rankings/gremlin/` |
| `multi-model-graph-databases` | 16 | 10 | `/rankings/multi-model/` |
| `embedded-graph-databases` | 15 | 2 | `/rankings/embedded/` |
| `gql-graph-databases` | 13 | 2 | `/rankings/gql/` |
| `graph-query-engines` | 8 | 1 | `/rankings/graph-query-engine/` |
| `graph-database-extensions` | 7 | 1 | `/rankings/graph-extension/` |

Deliberately excluded:

- **`graph-libraries`** — 5 active members, 0 surveyed. Below the gate.
- **A SPARQL roundup** — 24 members that overlap `rdf-triplestores` almost entirely. Two
  near-identical pages competing for one intent is the cannibalisation this section is
  trying to avoid.
- **`proprietary-graph-databases`** — 32 members, but "proprietary graph database" is not a
  search anyone performs. `enterprise-graph-platforms` covers the intent.
- **A `gdotv_support` roundup** — 33 members, and the field tracks support by a single
  commercial visualisation vendor. A page segmented by one vendor's product compatibility
  reads as placement whether or not money is involved. Excluded on the same principle as
  §2.6.

### 3.4 Rendering a roundup

No slice is small enough for a pure column layout — the smallest is 7. So every roundup
uses the same two-tier structure:

**Tier 1 — the comparison columns.** The top 6 members by overall rank, rendered by the
*same component as the pair page* (§2.2), with the same sticky headers, the same row
groups, the same difference rule, the same no-winner rule. Six columns rather than the
builder's four because this is server-rendered with no add control, and 6 is what fits the
row-label column at 1280px before horizontal scroll starts. This is the part that earns the
"compared" keyword.

**Tier 2 — the full segment table.** Every remaining member as rows, reusing the homepage's
existing table treatment: favicon, name, vendor, type, category, license, implementation
language, query languages, rank. Compact, scannable, and it links every member to its
`/db/<slug>/` page. A 72-member roundup is a table of 66 rows under 6 columns, which is a
normal page, not an overwhelming one.

**The feature matrix is conditional on coverage.** With 2 of 15 members surveyed
(`embedded-graph-databases`), a 43-row feature matrix would be a wall of `—` that makes the
page look broken and the data look absent rather than un-surveyed. Rule: render the feature
matrix in tier 1 only when **at least 4 of the 6 column engines are surveyed**; otherwise
omit it and note once, plainly: `Survey feature scores are available for 2 of these 15
engines. See each engine's page.` Under that rule the matrix renders for
`multi-model`, `enterprise`, `established`, `java`, `gremlin` and `cpp`, and is suppressed
for `embedded`, `rust`, `gql`, `graph-query-engines` and `graph-database-extensions` —
which matches where the data actually is.

**Prose** follows §2.5 exactly: a deterministic fact summary, no adjectives, no
recommendation. Per roundup:

> 15 active embedded graph databases are in the catalogue. They are written mostly in C++
> and Rust, 13 are open source, and 2 carry survey feature scores. Kùzu, archived in
> October 2025, is listed separately below.

Every clause is a count or a field lookup.

**Sponsor slot**: one, same placement and same `getSponsor(sponsors, 'compare')` key as
pair pages, with the same suppression when the sponsor's engine appears in the columns
(§2.6). Roundups are a mechanical surface — membership is a filter over catalogue fields,
and order is the mechanical rank.

### 3.5 Titles, headings and meta

Patterns chosen so no roundup title collides with a board title:

| | Pattern | Example |
|---|---|---|
| `<title>` | `{Segment} Compared — {n} Engines \| GDB-Engines` | `Embedded Graph Databases Compared — 15 Engines \| GDB-Engines` |
| `<h1>` | `{Segment} compared` | `Embedded graph databases compared` |
| Meta | `Compare the {n} {segment} in the catalogue: license, query languages, implementation language and feature scores. Updated {month}.` | — |

Compare against the board it sits beside: `Embedded Popularity Ranking` vs
`Embedded Graph Databases Compared`. Different head term, different intent, both honest.

The engine count in the title is a real number that changes as the catalogue grows, which
also gives the page an honest reason to be re-crawled.

**JSON-LD**: `BreadcrumbList` (Home → Comparisons → segment) plus an `ItemList` of all
members pointing at their `/db/<slug>/` pages — the same pattern as ranking boards and pair
pages. No `FAQPage`, no `Product`, no ratings, per §5.

### 3.6 Internal linking

Roundups are the human-browsable entry point, so they carry the most outbound links of any
page in this design:

- Every member links to its `/db/<slug>/` page.
- **Each of the 6 column engines links to its pair pages against the other 5** — 15 pair
  links per roundup, all of them pre-generated, since the top-6 of a segment are drawn from
  the top of the overall rank and fall inside Set A. This is the main crawl path into the
  pair set from a browsable page.
- The corresponding ranking board (§3.1), reciprocally.
- Two or three sibling roundups sharing a member.
- Engine detail pages gain a `Part of` line listing the roundups the engine belongs to —
  a reverse index built at build time, capped at three, which gives every roundup 6–72
  inbound links from established pages.

## 4. The add-database combobox

### 4.1 Data source

**Not `/api.json`.** It carries a full 43-key `features` object per engine, which is far
more than a picker needs. Add a dedicated build-time endpoint:

```
GET /compare-index.json
[{ "slug": "neo4j", "name": "Neo4j", "aliases": ["Neo Technology"],
   "icon": "/logos/neo4j.png", "rank": 1 }, ...]
+ a `pregenerated` array of pair slugs, for the canonical-redirect check in §1.4
```

Roughly 20 KB, well under 6 KB gzipped, cached with the site's default headers. `aliases`
is populated from the existing `previous_names` and `previous_vendors` fields, so typing
`RedisGraph` finds FalkorDB — the catalogue already carries the data and nothing else uses
it for search.

### 4.2 Favicons

**Already solved by the existing pipeline — reuse it, add nothing.** `prebuild` runs
`scripts/extract-favicons.mjs`, which fetches Google's s2 favicon service for the
engine's hostname, falls back to the GitHub org avatar, and byte-compares the result
against the known generic and GitHub placeholders so blanks are rejected rather than
shipped. Output is self-hosted at `public/logos/<slug>.png` at 32px.

The combobox renders these at 16px (2× source, crisp on retina), `loading="lazy"`,
`alt=""`, `width`/`height` set to avoid layout shift as the list filters.

**Fallback** where no PNG exists: `fetchFavicon` currently returns `/favicon.svg`, which
is the *site's own* icon and reads as though every unknown engine belongs to GDB-Engines.
For this component, render a monogram chip instead — the engine's first letter in
`Familjen Grotesk` 600 on `--color-surface`, same 16px box. Distinguishable at a glance,
no network request, no CSP change (`img-src` already permits `self` and `https:`).

### 4.3 Interaction

A `role="combobox"` input over a `role="listbox"` of `role="option"` items, with
`aria-expanded`, `aria-controls` and `aria-activedescendant` — not a native `<select>`,
which cannot show icons.

- **Matching**, evaluated over all 143 entries synchronously (no debounce needed at this
  size), ranked: exact slug → name prefix → name substring → alias substring. Ties break
  by overall rank, so `neo` surfaces Neo4j before Neptune.
- **Keyboard.** `↑`/`↓` move the active option and wrap; `Enter` adds it; `Esc` closes the
  list and keeps focus; `Home`/`End` jump; `Backspace` on an empty input removes the last
  selected column. Already-selected engines stay visible in the list with
  `aria-disabled="true"` and a `Selected` label rather than vanishing.
- **Announcement.** An `aria-live="polite"` region reports `Memgraph added, 2 databases
  selected`.
- **Max columns: 4.** Beyond four the row label column plus data columns stop fitting a
  1280px viewport without unreadable truncation, and no real comparison query has five
  operands. At four, the add control is `disabled` with the label `Remove a database to
  add another`. Plain statement, no scolding.

### 4.4 URL behaviour

| Where | Action | Result |
|---|---|---|
| `/compare/a-vs-b/` | add a third | `location.assign('/compare/custom/?db=a&db=b&db=c')` |
| `/compare/a-vs-b/` | swap one out | navigate to the new pair's canonical URL if pre-generated, else to the builder |
| `/compare/custom/` | add or remove | `history.replaceState` to keep `?db=` in sync — no history spam |
| `/compare/custom/` | selection narrows to a pre-generated pair | `location.assign` to the canonical page, so the visitor lands on the indexable, faster URL |

Full navigation on pre-generated pages rather than client-side re-render: the static page
is the product, and re-rendering it in JS would mean shipping a second implementation of
the whole comparison table.

### 4.5 Progressive enhancement

Non-negotiable, because the crawler is the primary consumer:

- **`/compare/a-vs-b/` renders the complete comparison server-side.** Every value, every
  feature row, the summary, the related links. No JS required to read it. The combobox is
  an enhancement that mounts only if the script runs; its container is empty in the HTML,
  so nothing breaks visually without it.
- The `Show only differing rows` toggle is JS-only and defaults to off, so the crawler
  always sees the full matrix.
- **`/compare/custom/` without JS** shows the hub's curated comparison directory and a
  line pointing at `/compare/`. It is noindex, so this costs nothing in search; it just
  avoids a blank page.
- Focus is visible throughout, the listbox traps nothing, and `prefers-reduced-motion` is
  respected.

---

## 5. Entry points

1,455 orphan pages do not get crawled. Internal linking is the part of this design most
likely to determine whether it works.

**The 14 roundups are the spine.** They are the only pages here a human would browse
voluntarily, they are few enough to link prominently from everywhere, and each one links
15 pair pages (§3.6). The linking scheme is built around them rather than around the pairs.

**`/compare/` — the hub.** Indexable, and the main distributor of internal PageRank. Three
sections, in this order:

1. **Browse by segment** — all 14 roundups, as cards with the segment name, member count
   and the favicons of the top 6 members. This is the top of the page: roundups are the
   browsable surface and the strongest pages in the set.
2. **The builder** — the combobox, for people who know the two databases they want.
3. **Popular comparisons** — ~40 curated pair links grouped by *Property graph*, *RDF*,
   *By query language*, and *Compared with Neo4j*.

A link directory, not another table. The homepage already owns the big-table treatment.

**From engine detail pages** (`/db/<slug>/`) — the highest-value path, since these pages
already have authority and 143 of them exist. Two additions:

- A **Compare with** section: 6–8 links to pre-generated pairs, chosen deterministically —
  the three nearest-ranked engines, the two highest-ranked engines sharing a query
  language, and the top two overall. Every pre-generated pair is reachable from at least
  one engine page by construction.
- A **Part of** line: up to three roundups this engine belongs to, from the reverse index
  in §3.6. This is what gives a roundup 6–72 inbound links from pages that already rank.

**From the rankings boards** — the reciprocal roundup link specified in §3.1, in the board
header, for the boards that have one. Plus a `Compare the top 5` link and adjacent-rank
compare links on the top 10 rows only. Adding a compare link to all 136 rows of every board
would dilute every other link on the page.

**From the site header** — a `Compare` link beside the existing `Rankings` link, added to
`SiteHeader.astro` so it appears on every page.

**Between comparison pages** — each pair page ends with 6 *Related comparisons* sharing one
of its two engines, plus a link to any roundup both engines belong to. Each roundup links
2–3 sibling roundups. This turns the set into a connected graph instead of 1,455 leaves, so
a crawler entering anywhere can walk the whole thing.

**From `llms.txt`** — a `## Comparisons` section listing the hub, all 14 roundups, and a
dozen representative pairs, matching the existing structure. The roundups are the entries
most likely to be cited by an AI answer, since they map onto how people actually ask.

Maximum crawl depth: 2 to any roundup (home → `/compare/` → roundup) and 2 to any
pre-generated pair (home → `/db/x/` → pair; or 3 via a roundup).

**Cannibalisation watch.** Three surfaces now use comparison vocabulary, so the head terms
have to be allocated deliberately:

| Page | Owns | Title |
|---|---|---|
| Homepage | *graph database comparison* (the whole catalogue, one table) | `GDB-Engines — Compare 143+ Graph Databases` (unchanged) |
| `/compare/` hub | *compare graph databases side by side* | `Compare Graph Databases Side by Side — GDB-Engines` |
| Roundup | *best / compared, per segment* | `{Segment} Compared — {n} Engines` (§3.5) |
| Ranking board | *most popular, per segment* | `{Segment} Popularity Ranking` (unchanged) |

The hub keeps a link-directory format rather than a table, so even where the phrasing is
close the page type is obviously different. Worth checking in Search Console after a month;
the roundup-vs-board pairs are the ones to watch, since those two genuinely cover the same
set of engines.

---

## 6. Structured data and SEO details

**Title.** `Neo4j vs Memgraph — Graph Database Comparison | GDB-Engines`. Truncates
gracefully; the operative words sit first.

**H1.** `Neo4j vs Memgraph` — the query verbatim, nothing appended.

**Meta description**, data-derived per pair:
`Compare Neo4j and Memgraph: 43 feature scores, licenses, query languages, and July 2026
popularity rankings. They differ on 11 features.`

**Canonical.** Self-canonical on pre-generated pages. `/compare/custom/` sets
`noindex, follow` via the `noindex` prop `Layout.astro` already supports — and correctly
emits *no* canonical in that case, per the comment already in the layout.

Roundup title/H1/meta patterns are in §3.5; they follow the same rules with the segment
name and member count in place of the two engine names.

**JSON-LD** — two blocks, matching the pattern on `rankings/[slug].astro`:

- `BreadcrumbList`: Home → Comparisons → Neo4j vs Memgraph (or → the segment name).
- `ItemList` of the compared engines — two for a pair, all members for a roundup — each
  `url` pointing at its `/db/<slug>/` page. This stitches the comparison into the existing
  crawl chain rather than sending crawlers to vendor sites.

**Explicitly not used:** `Product`, `Review`, `AggregateRating`, `FAQPage`. There are no
ratings, no reviews and no Q&A on the page. Marking up ratings the site does not compute
invites a structured-data manual action and would contradict the no-winner position in
§2.4. Worth stating here so it does not get "improved" in later.

**OG images.** Reuse a single static `/og-compare.png` for pair pages. Per-pair generation
would mean 1,455 additional `canvaskit-wasm` renders on every deploy — the existing
`astro-og-canvas` route only produces ~40 for the ranking boards — plus 1,455 more files
against the 20,000 cap. The traffic is search, not social.

**The 14 roundups are the exception**: generate a real OG image for each, at
`/og/compare/[roundup].png`, following the existing `/og/rankings/[...route].ts` pattern.
Fourteen renders is a rounding error on build time, and roundups are the pages plausibly
shared in a Slack or a newsletter — "embedded graph databases compared" travels, "Neo4j vs
Memgraph" does not.

---

## 7. Promoting combinations from the builder

The builder is the design's instrument for finding out what to pre-generate next. The
mechanism is deliberately manual — a monthly read, not a pipeline.

**What is already wired.** `Layout.astro` loads **Seline** from the first-party proxy
`sln.gdb-engines.com`, gated on `PUBLIC_SELINE_TOKEN`, and `public/_headers` already
permits that host in both `script-src` and `connect-src`. Seline supports custom events, so
no new vendor, no new CSP entry, no cookie banner question to reopen.

**One event.** On `/compare/custom/`, once per page view, debounced 2s after the last
selection change so intermediate states are not counted:

```js
seline.track('compare_custom', { engines: sorted.join(','), count: sorted.length });
```

`engines` is the alphabetically sorted slug list, so `a,b` and `b,a` aggregate to one row.
Nothing else is collected — no free-text, no partial input from the combobox.

**Search Console** covers the other half: queries and impressions for `/compare/*`, which
catches demand for combinations nobody reached the builder to try.

**The monthly review**, done by hand alongside the existing rankings refresh:

1. Top `compare_custom` combinations of `count == 2` → if any sits outside the
   pre-generated set with meaningful volume, it is a signal that `peerDepth` or
   `anchorDepth` is set too low. Adjust the constant rather than allowlisting the pair —
   one number is easier to reason about than a growing list of exceptions.
2. Top combinations of `count >= 3` → these are roundup candidates. A recurring trio is
   usually a segment being expressed the long way round ("neo4j, memgraph, falkordb" is
   *open-source Cypher databases*). Prefer adding or widening a roundup over adding a
   triple page.
3. Search Console `/compare/*` queries with impressions and no clicks → a title or meta
   problem on an existing page, not a missing page.
4. Queries matching a segment with no roundup → a new entry in
   `src/content/roundups/`.

**Deliberately not automated.** A rule that promotes pages on a traffic threshold would
recreate the combinatorial-bloat problem with extra steps, and at ~500 visitors/month the
data is too thin to be trustworthy without a human looking at it. Four numbers once a
month is the right amount of process.

---

## 8. Phased plan

**Phase 1 — smallest shippable SEO capture.** No JavaScript.

- `src/lib/comparisons.ts` with `selectPairs`, seeded at `peerDepth: 24` and the coverage
  gate on → `C(24,2)` = 276 candidates, **~230 pages** after dropping pairs where neither
  engine is surveyed.
- `src/pages/compare/[entry].astro` handling the `pair` branch only: sticky headers,
  at-a-glance, fundamentals, full feature matrix with the difference rule, fact summary,
  key-differences bullets, links.
- `src/pages/compare/index.astro`: the hub, as a static curated pair directory (no
  roundup section, no combobox yet).
- `Compare with` links on the 24 covered engine detail pages; `Compare` in `SiteHeader`.
- Sitemap `serialize` branch; title/meta/canonical/JSON-LD.
- `src/lib/favicon-map.ts` extraction.

This is the SEO thesis, live and crawlable, at a page count small enough to measure
honestly before scaling. Deliberately ships before both the combobox and the roundups: the
selectbox is a usability feature, and roundups need the pair component to exist first since
they reuse it for their column tier.

**Phase 2 — roundups and the builder.** The roundups are the larger SEO addition and
should land first within this phase.

- Roundup content collection + Zod schema; the 14 definition TOMLs from §3.3.
- `resolveRoundup`, the `roundup` branch of `[entry].astro`: 6-column tier reusing the
  phase-1 component, full-segment table, conditional feature matrix, `No longer active`
  footnote.
- Reciprocal roundup ↔ ranking-board links; `Part of` reverse index on engine pages.
- Hub restructured with **Browse by segment** at the top.
- 14 roundup OG images.
- `/compare-index.json` endpoint.
- The combobox with favicons, keyboard support and the monogram fallback, mounted on the
  hub, pair pages and roundups.
- `/compare/custom/` with `noindex, follow`, 2–4 columns, `?db=` sync, canonical redirect.
- `_redirects` splat rule, **verified on a preview deployment**.
- Raise `peerDepth` to 40 and `anchorDepth` to 10 → **1,455 pages** after the gate.
- Related-comparison cross-links; `llms.txt` section; `Show only differing rows` toggle.
- The `compare_custom` Seline event (§7).

**Phase 3 — conditional on evidence.**

- Agent-readiness row group, once the index ships from the private repo. Requires the
  editorial separation and sponsor exclusion in §2.3.
- Rank sparkline. **Blocked upstream**: `ranking.json` has no history. Needs the rankings
  generator to emit `rankHistory: [{ month, rank }]` per engine, reading the snapshots
  already in `history/`. Only 4 monthly snapshots exist (May–July 2026), so a sparkline is
  thin until roughly six; the `▲/▼` delta covers it until then.
- New roundups, or widened existing ones, from the monthly review in §7.
- Curated 3-way pages, only if a specific named triple shows demand that a roundup cannot
  absorb.
- Per-pair OG images, if social referral appears in analytics.

---

## 9. Assumptions

cjlm was not available while this was written. Each open question is listed with the
assumption taken and why.

1. **Pre-generate a weighted subset rather than all 10,153 pairs.** Assumed the index-bloat
   risk to a 500-visitor/month site outweighs the tail. Reversible: it is two constants.
2. **Drop the 355 pairs where neither engine has been surveyed.** Assumed a page built from
   identity plus five catalogue fields is too thin to publish 355 times. The alternative
   reading — that rank plus license plus query language is enough — is defensible; it is
   one boolean.
3. **No generated prose, no winner verdict.** Assumed credibility is the asset and a
   templated narrative or a summed score would spend it.
4. **Roundups are separated from ranking boards by intent, not by segment.** Assumed
   "compare the embedded databases" and "rank the embedded databases" are different enough
   queries to justify two pages over the same engines. This is the assumption most worth
   checking: if Search Console shows a roundup and its board trading positions for the same
   query, the roundup should absorb the board's segment rather than compete with it. The
   title rules in §3.5 are the hedge.
5. **The 14-roundup list, and its exclusions.** Membership counts are computed, but which
   segments are worth a page is editorial. `open-source-graph-databases` (72 members) is
   the widest and the least certain. The gdotv exclusion is a judgement call about how a
   single-vendor compatibility field would read.
6. **Six columns on a roundup, four in the builder.** Assumed by readability at 1280px;
   the roundup gets more because it is server-rendered with no add control.
7. **Comparison pages and roundups carry a sponsor slot, keyed site-wide rather than per
   engine.** Assumed consistent with the mechanical-surface rule; the per-engine exclusion
   is the conservative reading.
8. **Promotion from the builder stays manual.** Assumed monthly review is proportionate at
   this traffic level and that automation would recreate the bloat problem.
9. **Sparkline deferred.** Not an editorial choice — the data does not exist in the file
   the site reads.
10. **`/compare/` hub does not compete with the homepage for "compare graph databases".**
    Assumed separable by title and content type; needs a Search Console check.
11. **Cloudflare Pages serves static assets in preference to `_redirects` splats.**
    Disproved on the preview deploy (2026-07-28): redirects preempt assets. The splat was
    dropped for the documented 404-page fallback (§1.4).
