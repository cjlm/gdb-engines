# Left-Aligned Compact Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group the compact logo and primary-navigation icons at the left edge while keeping theme, About, and Options pinned to the right.

**Architecture:** Preserve the existing two-group flex header and all current responsive breakpoints. Change only the compact primary navigation's main-axis alignment at `max-width: 36rem`; its flexible container continues to occupy the space between the logo and utilities, but its three links stop distributing themselves across that space.

**Tech Stack:** Astro, nested CSS in `src/styles/global.css`, in-app browser geometry assertions, Astro production build

## Global Constraints

- At and below `36rem` (576px), the left group is logo, Rankings, Graph, and Compare in that order.
- Compact navigation labels remain hidden and the home link remains logo-only.
- The compact primary navigation uses the existing `0.25rem` (4px) gap between links.
- Theme, About, and Options remain a separate group pinned to the right edge.
- The `39rem`, `55rem`, and `22rem` responsive behaviors remain unchanged.
- Do not change the sponsorship pane, search-field breakpoint, control sizing, or accessible labels.
- Add no dependencies and create no new production component.

---

### Task 1: Left-align the compact primary navigation

**Files:**
- Modify: `src/styles/global.css:270-290`
- Test: no persistent test file; use a browser geometry regression assertion because the repository has no browser-test framework

**Interfaces:**
- Consumes: existing `.site-header`, `.left`, `.primary-nav`, `.rankings-link`, and `.right` flex layout
- Produces: compact `.primary-nav` content aligned with `justify-content: flex-start` at `max-width: 36rem`

- [ ] **Step 1: Run a failing compact-alignment regression assertion**

With the local site open at `/`, claim the preview tab as `tab` and create a viewport-capability binding as `viewport`. Run this assertion at the exact compact breakpoint and representative smaller widths:

```js
const widths = [576, 532, 375, 320];
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

Expected: FAIL because `space-evenly` creates viewport-dependent leading and inter-link gaps.

- [ ] **Step 2: Implement the minimal compact-layout change**

In the existing `@media (max-width: 36rem)` block, change only the primary navigation alignment:

```css
.primary-nav {
  flex: 1 1 auto;
  justify-content: flex-start;
  gap: 0.25rem;
}
```

- [ ] **Step 3: Rerun the browser regression assertion**

Run the Step 1 assertion unchanged.

Expected: PASS at 576, 532, 375, and 320px. `leadingGap` is within 0.5px of zero, each inter-link gap is within 0.5px of 4px, and the last navigation link does not cross the utility group's left edge.

- [ ] **Step 4: Visually verify the compact and adjacent layouts**

Capture light-mode screenshots at 577, 576, 532, 375, and 320px and a dark-mode screenshot at 532px.

Expected:

- At 577px, labelled navigation remains unchanged.
- At 576px and below, logo and navigation icons read as one left-aligned group.
- Theme, About, and Options remain aligned as the right group.
- No controls overlap or clip, and the sponsorship pane remains in normal flow.

- [ ] **Step 5: Run repository verification**

Run:

```bash
git diff --check
npm run build
```

Expected: `git diff --check` exits 0. The build reports 145/145 evidence entries with 0 errors, produces 1,757 pages, and completes successfully; the existing evidence-refetch warnings may remain.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/styles/global.css
git commit -m "Left-align compact header navigation"
```

