# Mobile Header and Sponsorship Pane Design

Date: 2026-08-13
Status: Approved in conversation

## Problem

The homepage header has narrow responsive failure bands. The original layout overlaps around 580 px, while hiding the wordmark throughout the first compact treatment makes the header look unnecessarily sparse at widths such as 440 and 532 px. At the desktop-search boundary, the database summary can also collapse to a one-character sliver beside the newly visible search field.

The homepage sponsorship disclosure is also unavailable on narrow screens. `SponsorBadge` is deliberately hidden below 72rem, leaving mobile visitors without the sponsorship information that appears elsewhere in the site.

## Goals

- Remove header overlap throughout the responsive range.
- Switch to compact icon-only navigation at and below 39rem.
- Keep compact navigation visually grouped with the home logo instead of distributing it across the header.
- Keep the wordmark visible through 433 px, including at 440 px, and hide it only when the complete header no longer fits.
- Prevent the database summary from appearing as clipped text beside the search field.
- Give narrow-screen homepage visitors a visible sponsorship message without adding another header control.
- Reuse the visual language of the existing sponsorship panels on rankings and graph pages.
- Avoid obstructing the comparison table or consuming persistent vertical space.

## Non-goals

- Redesigning the primary navigation, Options menu, or table controls.
- Changing the desktop `SponsorBadge` disclosure or its 72rem visibility threshold.
- Changing sponsorship placement on rankings, graph, or comparison-detail pages.
- Changing the comparison table's horizontal scrolling or sticky-column behavior.

## Responsive Header Design

Use a staged, brand-first collapse:

- Above 39rem (624 px), show the wordmark and labelled Rankings/Graph/Compare links.
- At and below 39rem, use a compact two-group layout. The left group contains the logo, wordmark, and the three icon-only navigation buttons, aligned from the left with a 0.25rem gap between navigation links. The right group keeps theme, About, and Options pinned to the right edge.
- At and below 27rem (432 px), hide `.header-brand`. The left group then contains only the logo and three navigation icons, leaving the required gap before the utility group.
- Do not use `space-evenly` for the compact primary navigation. The primary navigation may retain flexible width to preserve separation from the right-side utilities, but its contents use start alignment so extra space remains between the two groups rather than between individual navigation buttons.
- Hide `.database-summary` at and below 64rem so it cannot collapse into a sliver when the search field returns. Keep the existing search-field cutoff at 55rem and the special 22rem About-button treatment.

The 39rem threshold is the last width before the labelled layout fits; the full layout remains intact at 625 px. The 27rem wordmark threshold follows measured fit rather than a device class: at 440 px the header has approximately 16 px between navigation and utilities, at 433 px it retains the configured 8 px separation, and at 432 px the wordmark is removed.

## Compact Sponsorship Pane

Add a compact variant of the existing `SponsorCTA` component so it shares the established gradient, border, typography, theme colors, and call-to-action styling without duplicating those rules.

The compact content is:

> **Independent graph database research.**<br>
> Sponsorship keeps GDB-Engines running.<br>
> **Sponsor us →**

The call to action links to `/sponsor/`.

On the homepage:

- Render the compact pane after the fixed site header and before `.comparison-stage`.
- Show it only at and below 39rem.
- Keep it in normal document flow; it scrolls away with the page and is never sticky or fixed.
- Inset it from the viewport edges using the same narrow-screen page spacing used elsewhere.
- When the pane is visible, it owns the space needed to clear the fixed header and the comparison stage no longer adds a second header-height offset. Above 39rem, the pane is hidden and the comparison stage retains its current header-height padding.
- Keep the pane outside the table's `width: max-content` stage so it is sized to the viewport rather than to the wide comparison table.

`SponsorCTA`'s current default output remains unchanged for existing rankings and graph consumers. The compact variant does not use the rotating phrase script because its shorter copy is fixed.

## Accessibility and Interaction

- Keep the sponsorship content in an `aside` labelled `Sponsor GDB-Engines`.
- Use a normal link for the call to action; no disclosure or JavaScript interaction is required.
- Preserve visible keyboard focus styling and the existing contrast-aware theme variables.
- Do not display both the compact pane and desktop `SponsorBadge` at the same viewport width.
- The header's existing link names and `aria-current` behavior remain unchanged.

## Verification

Use browser geometry assertions to verify that the primary navigation's right edge does not pass the utility group's left edge at 625, 624, 532, 440, 433, 432, 375, and 320 px.

Also verify:

- The wordmark is visible from 625 through 433 px and hidden at 432 px and below.
- Navigation labels are visible at 625 px and switch to icons at 624 px.
- At 624, 532, 440, 433, 432, 375, and 320 px, the brand and navigation form one left-aligned cluster while theme, About, and Options remain a separate right-aligned cluster.
- The gaps between compact navigation icons stay equal to the configured navigation gap rather than expanding with viewport width.
- At 881 and 1024 px the search field is visible while the database summary is hidden; at 1025 px the summary can return without overlap.
- The compact sponsorship pane is visible at 624 px and below, hidden at 625 px and above, and links to `/sponsor/`.
- The existing desktop sponsor badge remains visible at its current 72rem threshold.
- The pane fits at 320 px without horizontal overflow.
- Light and dark mode screenshots at representative compact widths show no collision, clipping, or table-header obstruction.
- The production build completes successfully.

## Alternatives Considered

- Keeping labelled navigation between 36rem and 39rem preserves text but produces an awkward intermediate hierarchy; switching the links to icons at 39rem keeps the wordmark and makes the compact header read as one coherent group.
- Hiding the wordmark at 39rem creates excessive empty space at common phone widths; the measured 27rem cutoff preserves the site identity until it is actually needed for fit.
- Distributing compact navigation with `space-evenly` uses the available width but makes related links look like unrelated controls; start alignment preserves their grouping and leaves flexible space between navigation and utilities.
- Adding sponsorship to the Options menu would save space but make it less discoverable and mix project support with table configuration.
- A sticky or fixed sponsorship banner would be more prominent but would obscure too much of the comparison table on a small screen.
