# Left-Aligned Compact Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group the compact brand and primary-navigation icons at the left edge while keeping theme, About, and Options pinned to the right, and preserve the wordmark for every width where it fits.

**Architecture:** Preserve the existing two-group flex header. At `max-width: 39rem`, hide the navigation labels and align the icon links from the left while retaining the wordmark. Hide the wordmark only at `max-width: 27rem`. Keep the search cutoff at `55rem`, but hide the database summary through `64rem` so it cannot collapse beside the search field.

**Tech Stack:** Astro, nested CSS in `src/styles/global.css`, in-app browser geometry assertions, Astro production build

## Global Constraints

- At and below `39rem` (624px), the left group is logo, wordmark, Rankings, Graph, and Compare in that order.
- Compact navigation labels remain hidden; the wordmark remains visible through 433px and hides at 432px.
- The compact primary navigation uses the existing `0.25rem` (4px) gap between links.
- Theme, About, and Options remain a separate group pinned to the right edge.
- The compact sponsorship pane remains visible through `39rem`, the search field remains hidden through `55rem`, and the About control retains its `22rem` treatment.
- The database summary is hidden through `64rem` so the search boundary has no clipped-text sliver.
- Do not change control sizing or accessible labels.
- Add no dependencies and create no new production component.

---

### Task 1: Left-align and stage the compact header

**Files:**
- Modify: `src/styles/global.css:270-290`
- Test: no persistent test file; use a browser geometry regression assertion because the repository has no browser-test framework

**Interfaces:**
- Consumes: existing `.site-header`, `.left`, `.primary-nav`, `.rankings-link`, and `.right` flex layout
- Produces: compact `.primary-nav` content aligned with `justify-content: flex-start` at `max-width: 39rem`, with the wordmark retained through 433px

- [ ] **Step 1: Run a failing compact-alignment regression assertion**

With the local site open at `/`, claim the preview tab as `tab` and create a viewport-capability binding as `viewport`. Run this assertion at the exact compact breakpoint and representative smaller widths:

```js
const widths = [624, 532, 440, 433, 432, 375, 320];
const failures = [];

for (const width of widths) {
  await viewport.set({ width, height: 700 });
  const state = await tab.playwright.evaluate(() => {
    const nav = document.querySelector('.primary-nav').getBoundingClientRect();
    const links = [...document.querySelectorAll('.primary-nav .rankings-link')]
      .map((element) => element.getBoundingClientRect());
    const utilities = document.querySelector('.site-header > .right').getBoundingClientRect();

    return {
      width: innerWidth,
      leadingGap: links[0].left - nav.left,
      linkGaps: links.slice(1).map((link, index) => link.left - links[index].right),
      navigationRight: links.at(-1).right,
      utilitiesLeft: utilities.left,
    };
  });

  const linksStartAtLeft = Math.abs(state.leadingGap) <= 0.5;
  const linksUseCompactGap = state.linkGaps.every((gap) => Math.abs(gap - 4) <= 0.5);
  const groupsDoNotOverlap = state.navigationRight <= state.utilitiesLeft;

  if (!linksStartAtLeft || !linksUseCompactGap || !groupsDoNotOverlap) failures.push(state);
}

if (failures.length) throw new Error(`Compact header alignment failed: ${JSON.stringify(failures)}`);
```

Expected: FAIL because the previous compact treatment starts too late and hides the wordmark too early.

- [ ] **Step 2: Implement the staged compact layout**

At `max-width: 39rem`, hide navigation labels and align the compact navigation from the left:

```css
.primary-nav {
  flex: 1 1 auto;
  justify-content: flex-start;
  gap: 0.25rem;
}
```

At `max-width: 27rem`, hide `.header-brand`. Separately, hide `.database-summary` through `64rem` while retaining the search field's existing `55rem` cutoff.

- [ ] **Step 3: Rerun the browser regression assertion**

Run the Step 1 assertion unchanged.

Expected: PASS at 624, 532, 440, 433, 432, 375, and 320px. `leadingGap` is within 0.5px of zero, each inter-link gap is within 0.5px of 4px, and the last navigation link does not cross the utility group's left edge. The wordmark is visible at 433px and hidden at 432px.

- [ ] **Step 4: Visually verify the compact and adjacent layouts**

Capture light- and dark-mode screenshots at representative widths including 624, 532, 440, 433, 432, 375, and 320px. Also inspect the 881px search boundary.

Expected:

- At 625px, labelled navigation remains unchanged; at 624px, the links switch to icons.
- Through 433px, the wordmark and navigation icons read as one left-aligned group; at 432px, the wordmark drops cleanly.
- Theme, About, and Options remain aligned as the right group.
- No controls overlap or clip, and the sponsorship pane remains in normal flow.
- At 881px, the search is visible without a clipped database-summary sliver.

- [ ] **Step 5: Run repository verification**

Run:

```bash
git diff --check
npm run build
```

Expected: `git diff --check` exits 0. The build reports 145/145 evidence entries with 0 errors, produces 2,201 pages on the current `main` baseline, and completes successfully; the existing evidence-refetch warnings may remain.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/styles/global.css \
  docs/superpowers/specs/2026-08-13-mobile-header-sponsorship-design.md \
  docs/superpowers/plans/2026-08-13-left-aligned-compact-header.md
git commit -m "Refine responsive header breakpoints"
```
