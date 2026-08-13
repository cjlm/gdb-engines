# Mobile Header and Sponsorship Pane Implementation Plan

> **Superseded responsive details:** The sponsorship work in this plan was implemented, but its header breakpoints were subsequently refined. The approved final header behavior is documented in `2026-08-13-left-aligned-compact-header.md`: navigation becomes icon-only at 39rem, while the wordmark remains visible through 433px and hides at 432px.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the homepage header's 577–620 px overlap and show a compact sponsorship pane above the comparison table on narrow screens.

**Architecture:** Add one intermediate header breakpoint that hides only the wordmark, extend `SponsorCTA` with an explicit `compact` rendering variant, and place that compact component outside the homepage's wide table stage. Page-scoped CSS controls mobile-only visibility and transfers the fixed-header clearance from the table stage to the pane.

**Tech Stack:** Astro 5 components, scoped CSS, global CSS, the Codex in-app browser for rendered geometry checks, and the existing Astro production build.

## Global Constraints

- Use 39rem (624 px) for the intermediate wordmark and compact-pane breakpoint.
- Keep the existing icon-only navigation breakpoint at 36rem (576 px).
- Keep `SponsorCTA`'s default rankings/graph output unchanged.
- Use the exact compact copy: `Independent graph database research.` and `Sponsorship keeps GDB-Engines running.`
- Use the exact compact CTA label `Sponsor us` and link it to `/sponsor/`.
- Keep the compact pane in normal document flow; it must not be sticky or fixed.
- Do not add dependencies or redesign the Options menu, table controls, or desktop `SponsorBadge`.

---

### Task 1: Stage the Header Collapse

**Files:**
- Modify: `src/styles/global.css:245-285`
- Test: rendered homepage at responsive viewports in the Codex in-app browser

**Interfaces:**
- Consumes: existing `.site-header`, `.header-brand`, `.primary-nav`, and `.site-header .right` selectors
- Produces: a 39rem wordmark breakpoint while preserving the existing 36rem compact-navigation contract

- [ ] **Step 1: Run the failing geometry check**

On the running homepage at 580 px, evaluate the real rendered header:

```js
const failure = await tab.playwright.evaluate(() => {
  const nav = document.querySelector('.primary-nav').getBoundingClientRect();
  const utilities = document.querySelector('.site-header .right').getBoundingClientRect();
  const brand = getComputedStyle(document.querySelector('.header-brand')).display;
  return { overlaps: nav.right > utilities.left, brand };
});
if (!failure.overlaps || failure.brand === 'none') {
  throw new Error(`Expected current 580px failure, got ${JSON.stringify(failure)}`);
}
```

Expected: the check confirms `overlaps: true` and `brand: "block"`; current measurements show about 37 px of overlap.

- [ ] **Step 2: Add the intermediate wordmark breakpoint**

Insert this media query before the existing 36rem query and remove the now-redundant `.header-brand` rule from the 36rem block:

```css
@media (max-width: 39rem) {
  .header-brand {
    display: none;
  }
}
```

- [ ] **Step 3: Run the passing geometry matrix**

For each width in `[625, 624, 620, 580, 577, 576, 375, 320]`, assert:

```js
const metrics = await tab.playwright.evaluate(() => {
  const nav = document.querySelector('.primary-nav').getBoundingClientRect();
  const utilities = document.querySelector('.site-header .right').getBoundingClientRect();
  const brand = getComputedStyle(document.querySelector('.header-brand')).display;
  const label = getComputedStyle(document.querySelector('.rankings-link__label')).display;
  return { overlaps: nav.right > utilities.left, brand, label };
});
if (metrics.overlaps) throw new Error(`${width}px header overlaps`);
if (width <= 624 && metrics.brand !== 'none') throw new Error(`${width}px wordmark visible`);
if (width === 625 && metrics.brand === 'none') throw new Error('625px wordmark hidden');
if (width >= 577 && metrics.label === 'none') throw new Error(`${width}px nav label hidden`);
if (width <= 576 && metrics.label !== 'none') throw new Error(`${width}px nav label visible`);
```

Expected: all assertions pass.

- [ ] **Step 4: Commit the header fix**

```bash
git add src/styles/global.css
git commit -m "Fix header overlap near mobile breakpoint"
```

### Task 2: Add and Integrate the Compact Sponsorship Pane

**Files:**
- Modify: `src/components/SponsorCTA.astro:1-81`
- Modify: `src/pages/index.astro:2-12,83-88,367-377`
- Test: rendered homepage component and layout contract in the Codex in-app browser

**Interfaces:**
- Consumes: Astro prop `compact?: boolean`, defaulting to `false`
- Produces: `<SponsorCTA compact />` with modifier class `sponsor-cta--compact`; `.mobile-sponsor-pane`, visible through 39rem and outside `.comparison-stage`; default `<SponsorCTA />` remains unchanged

- [ ] **Step 1: Run the failing compact-pane contract**

Before editing production files, run this positive assertion against the homepage:

```js
const compactCount = await tab.playwright.locator('.mobile-sponsor-pane .sponsor-cta--compact').count();
if (compactCount !== 1) {
  throw new Error(`Expected one compact sponsorship pane, found ${compactCount}`);
}
```

Expected: FAIL with `Expected one compact sponsorship pane, found 0` because the feature is missing.

- [ ] **Step 2: Add the `compact` prop and conditional copy**

Add this frontmatter contract:

```astro
interface Props {
  compact?: boolean;
}

const { compact = false } = Astro.props;
```

Change the `aside` class and body to:

```astro
<aside class:list={['sponsor-cta', compact && 'sponsor-cta--compact']} aria-label="Sponsor GDB-Engines">
  {compact ? (
    <>
      <span class="sponsor-cta__copy">
        <strong>Independent graph database research.</strong>{' '}
        Sponsorship keeps GDB-Engines running.
      </span>
      <a href="/sponsor/">Sponsor us <span aria-hidden="true">→</span></a>
    </>
  ) : (
    <>
      <span class="sponsor-cta__copy">
        <strong>GDB-Engines provides an independent, evidence-led view of the graph database landscape.</strong>{' '}
        Sponsorship helps sustain the project – and connects vendors with users trying to tell their{' '}
        <span class="sponsor-cta__pair" data-sponsor-pairs={JSON.stringify(pairings)}>GQL from their GraphQL</span>.
      </span>
      <a href="/sponsor/">Get in touch <span aria-hidden="true">→</span></a>
    </>
  )}
</aside>
```

- [ ] **Step 3: Add compact styling without changing the default variant**

Add:

```css
.sponsor-cta--compact {
  max-width: none;
  margin: 0;
  padding: 0.7rem 0.75rem 0.7rem 0.85rem;
  font-size: 0.8rem;
}

.sponsor-cta--compact a {
  white-space: nowrap;
}
```

Inside the existing 32rem media query, keep the compact variant on one row:

```css
.sponsor-cta--compact {
  align-items: center;
  flex-direction: row;
  gap: 0.65rem;
}
```

- [ ] **Step 4: Add the component import and homepage markup**

Add:

```astro
import SponsorCTA from '../components/SponsorCTA.astro';
```

Render it between the visually hidden heading and comparison stage:

```astro
<div class="mobile-sponsor-pane">
  <SponsorCTA compact />
</div>
```

- [ ] **Step 5: Add page-scoped responsive layout**

Add to the homepage style block:

```css
.mobile-sponsor-pane {
  display: none;
}

@media (max-width: 39rem) {
  .mobile-sponsor-pane {
    display: block;
    padding: calc(var(--header-height) + 0.75rem) 0.75rem 0.75rem;
  }

  .comparison-stage {
    padding-top: 0;
  }
}
```

- [ ] **Step 6: Run the passing compact-pane contract**

At 624, 580, 375, and 320 px, assert:

```js
const pane = tab.playwright.locator('.mobile-sponsor-pane');
const compact = tab.playwright.locator('.mobile-sponsor-pane .sponsor-cta--compact');
const link = tab.playwright.locator('.mobile-sponsor-pane a[href="/sponsor/"]');
if (await pane.count() !== 1 || !await pane.isVisible()) throw new Error(`${width}px pane missing`);
if (await compact.count() !== 1) throw new Error(`${width}px compact variant missing`);
if (await link.count() !== 1) throw new Error(`${width}px sponsor link missing`);
const layout = await tab.playwright.evaluate(() => ({
  panePosition: getComputedStyle(document.querySelector('.mobile-sponsor-pane')).position,
  paneLeft: document.querySelector('.mobile-sponsor-pane .sponsor-cta').getBoundingClientRect().left,
  paneRight: document.querySelector('.mobile-sponsor-pane .sponsor-cta').getBoundingClientRect().right,
  viewportWidth: innerWidth,
  paneBottom: document.querySelector('.mobile-sponsor-pane').getBoundingClientRect().bottom,
  tableTop: document.querySelector('.comparison-stage').getBoundingClientRect().top
}));
if (layout.panePosition === 'fixed' || layout.panePosition === 'sticky') throw new Error('Pane is persistent');
if (layout.paneLeft < 0 || layout.paneRight > layout.viewportWidth) throw new Error('Pane overflows viewport');
if (layout.tableTop < layout.paneBottom) throw new Error('Pane overlaps table');
```

At 625 px, assert `.mobile-sponsor-pane` is hidden and `.comparison-stage` starts at `var(--header-height)`.

- [ ] **Step 7: Verify existing default sponsor panels are unchanged**

Open `/rankings/` and `/graph/query-languages/` and assert each visible `.sponsor-cta` lacks the `sponsor-cta--compact` modifier, still contains the `Get in touch` link, and retains the full evidence-led sponsorship copy.

- [ ] **Step 8: Visually inspect light and dark modes**

Capture viewport screenshots at 580 and 375 px in both themes. Confirm the header groups do not collide, the pane is inset and legible, the CTA remains within the pane at 320 px, and the table header starts below the pane before becoming sticky below the fixed header during scrolling.

- [ ] **Step 9: Run full verification**

Run:

```bash
npm run build
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 10: Commit the completed feature**

```bash
git add src/components/SponsorCTA.astro src/pages/index.astro docs/superpowers/plans/2026-08-13-mobile-header-sponsorship.md
git commit -m "Show compact sponsorship pane on mobile"
```
