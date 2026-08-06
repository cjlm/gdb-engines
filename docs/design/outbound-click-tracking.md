# Outbound click tracking – design

Status: implemented.

The question behind this work was "which pages do people leave from". Seline already
answers that one: it ships a **Common exit pages** report and an `exitPage` filter
dimension that can be applied across every other report (pages, referrers, countries,
custom events). The site is a plain Astro MPA with no view transitions and no prefetch,
so Seline's automatic pageview tracking already reconstructs the full session path it
needs. No code was required for the literal question.

What the built-in report cannot answer is **where people go when they leave**. On this
site most leaving is a click out to a vendor site, a GitHub repo, or a citation, and
every one of those links is `target="_blank"`. Seline records `/db/neo4j/` as the exit
page whether the visitor clicked through to neo4j.com and closed the tab satisfied, or
bounced because the page was useless. Those two outcomes mean opposite things and are
indistinguishable without an outbound click event.

This design adds that event.

---

## 0. Ground truth this design is built on

Read from the repo, not assumed:

| Fact | Source |
|---|---|
| Analytics is Seline, loaded in `<head>` from the first-party proxy `sln.gdb-engines.com`, gated on `PUBLIC_SELINE_TOKEN`, with `id="seline-script"` and `async` | `src/layouts/Layout.astro` |
| CSP already permits `script-src` and `connect-src` to `sln.gdb-engines.com`. No header change needed | `public/_headers` |
| No view transitions, no `ClientRouter`, no prefetch anywhere in the repo | grep returns zero hits |
| A `track()` helper already exists that queues events until the async Seline script loads | `src/scripts/seline.ts` |
| `trackDatabaseComparison()` is the only existing custom event, named `comparison: viewed` | `src/scripts/seline.ts` |
| The custom-event call in `compare-builder.ts` is already debounced by 2s | `src/scripts/compare-builder.ts` |
| Every outbound link on the site is `target="_blank"` | grep across `src/pages`, `src/components` |
| Engine website links are already UTM-tagged `utm_source=gdb-engines&utm_medium=referral`; GitHub links are not | `index.astro`, `db/[slug].astro`, `RankingTable.astro` |
| The only outbound sponsor link is in `SponsorSlot.astro`. `SponsorBadge` and `SponsorCTA` link to the internal `/sponsor/` page | `src/components/Sponsor*.astro` |
| `/sponsor/` contains a `mailto:` link | `src/pages/sponsor.astro` |
| Seline stamps the current page onto every custom event – that is why `page` is a filter dimension | Seline API docs, `page` filter |

---

## 1. Event

Name: **`outbound: clicked`**, following the `object: action` convention Seline recommends
and `comparison: viewed` already uses.

| Property | Value | Notes |
|---|---|---|
| `destination` | Link hostname, lowercased, `www.` stripped | `neo4j.com`, `github.com`, `arxiv.org`. Low cardinality, reads well ungrouped in the dashboard |
| `kind` | `engine-site` \| `engine-github` \| `gdotv` \| `sponsor` \| `citation` \| `other` | Where the link sits in the page |
| `database` | Catalogue slug | Present only on engine and gdotv links |

There is deliberately **no source-page property**. Seline already attaches the current
page to every custom event, so the exit-page attribution this whole exercise is about
comes free via the existing `page` dimension. Adding a `from` property would duplicate it.

`database` is what makes the event useful. Without it every engine repo click collapses
into an undifferentiated `github.com`, and the single most interesting question – which
engines pull people off the site – is unanswerable.

---

## 2. Collection

A single delegated listener in `src/scripts/outbound.ts`, imported once site-wide from
`Layout.astro` alongside `theme.ts` and `tooltip-flip.ts`.

Rejected alternatives:

- **`data-sln-event` attributes on every link.** Seline handles these natively with no JS
  of ours, but it repeats the event name and every property across ~14 markup sites, and
  Seline binds its own handler only after the async script loads, so early clicks are
  dropped. That is the exact problem `seline.ts` was written to solve.
- **Per-page inline scripts.** The same listener duplicated in six files.

The handler:

1. Ignores `event.button > 1`, so a right-click that opens a context menu is not counted
   as a departure.
2. Resolves the link with `closest('a[href]')`, which handles clicks landing on the SVG
   icon nested inside most of these links.
3. Skips same-origin links and any protocol that is not `http:`/`https:` (the `mailto:`
   on `/sponsor/`).
4. Reads `kind` and `database` from data attributes and reports through `track()`.

Bound to both `click` and `auxclick`: middle-click opens a link in a new tab but fires
`auxclick`, not `click`. Cmd/ctrl-click fires `click` normally.

Because every outbound link is `target="_blank"`, the page is never unloaded by the
click. No `sendBeacon`, no `keepalive`, no unload race.

---

## 3. Classification

Declarative, read from markup, never sniffed from the URL. Deriving `engine-github` from
`hostname === 'github.com'` is not hypothetically wrong here, it is wrong at scale: across
the built site, **428 engine *website* links point at github.com**, because many engines
use their repo as their homepage. Hostname sniffing would file every one of them as a repo
click.

| Attribute | Applied to |
|---|---|
| `data-outbound="engine-site" data-db={slug}` | Engine website links |
| `data-outbound="engine-github" data-db={slug}` | Engine GitHub links |
| `data-outbound="gdotv" data-db={slug}` | The gdotv support cell on the homepage table |
| `data-outbound="sponsor"` | `SponsorSlot.astro` |
| `data-outbound="citation"` | Evidence sources and Internet Archive links on `/db/[slug]/` |

Any external link without `data-outbound` falls through to `kind: "other"`. That covers
the header/footer/about/404 links to this project's own repo and the arXiv citation on the
homepage without touching those files, and they remain identifiable by `destination`.

An unrecognised `data-outbound` value also falls through to `other` rather than being
passed to the dashboard, so a typo cannot create a phantom category.

---

## 4. One fix to existing code

`seline.ts` queues pending events in a `Map` keyed by event name, so only the newest
event of each name survives the window before the async script loads. For a
once-per-page view event that is harmless. For outbound clicks it silently drops all but
the last of a rapid burst.

The queue becomes an ordered array. Nothing depends on the dedupe: `compare-builder.ts`
already debounces its call by 2s, and the `/compare/[entry]/` call fires once per page.
The change also makes pre-load behaviour consistent with post-load, where every event is
already sent individually.

`track()` becomes exported so `outbound.ts` can use it. It returns early when
`#seline-script` is absent, so with no `PUBLIC_SELINE_TOKEN` in dev nothing is queued and
the array cannot grow unbounded.

---

## 5. Files

| File | Change |
|---|---|
| `src/scripts/seline.ts` | Export `track`, queue as array, early return when analytics is off |
| `src/scripts/outbound.ts` | New – the delegated listener |
| `src/layouts/Layout.astro` | One import |
| `src/pages/index.astro` | Attributes on website, GitHub, gdotv links |
| `src/pages/db/[slug].astro` | Attributes on website, GitHub ×2, source, archive links |
| `src/pages/compare/[entry].astro` | Attributes on website, GitHub links |
| `src/components/RankingTable.astro` | Attributes on GitHub, website links |
| `src/components/SponsorSlot.astro` | Attribute on the sponsor link |

---

## 6. Reading the data

- **Where a page sends people:** filter to `event: outbound: clicked`, add
  `page is /db/neo4j/`, group by `destination`.
- **Which engines pull hardest:** filter to `event: outbound: clicked`, group by
  `database`.
- **Satisfied exit vs dead end:** apply `exitPage is /db/neo4j/` and check whether the
  outbound event fires in those sessions. Exit pages with a high outbound rate finished
  the visitor's journey; exit pages with a low one failed it.
- **Sponsor click-through:** filter to `kind is sponsor`.

---

## 7. Verification

There is no test runner in this repo.

**Coverage.** Every anchor across all 1,658 built pages was enumerated and classified.
External links total 7,203, and every one lands in an intended bucket:

| kind | count |
|---|---|
| `engine-site` | 3,864 |
| `engine-github` | 3,052 |
| `citation` | 243 |
| `gdotv` | 35 |
| `other` | 9 |

The `other` bucket is exactly the 5 links to this project's own repo (homepage menu,
`/about/`, `/404/`), 3 `mailto:` links on `/sponsor/` that the protocol guard drops at
runtime, and the 1 arXiv citation on the homepage. Nothing is unaccounted for.

**Behaviour.** Against `astro dev`, with `window.seline` stubbed so no request left the
machine, seven dispatched events produced four tracked events:

| Dispatched | Result |
|---|---|
| Click on engine website link | `engine-site` · `neo4j.com` · `neo4j` |
| Click on the `<svg>` nested inside a GitHub link | `engine-github` · `github.com` · `neo4j` – `closest('a')` resolved it |
| Click on a citation link | `citation` · `neo4j.com` · no `database` |
| Click on an internal link | silent |
| Click on a `mailto:` link | silent |
| `auxclick` button 1 (middle) | `engine-github` · `github.com` · `neo4j` |
| `auxclick` button 2 (right) | silent |

**Queue.** With Seline forced unavailable, a burst of 5 clicks flushed all 5 in document
order once the script's `load` fired. Under the previous `Map` queue exactly 1 would have
survived.
