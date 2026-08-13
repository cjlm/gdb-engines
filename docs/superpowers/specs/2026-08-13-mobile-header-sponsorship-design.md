# Mobile Header and Sponsorship Pane Design

Date: 2026-08-13
Status: Approved in conversation

## Problem

The homepage header has a narrow responsive failure band. On the comparison page at a 580 px viewport, the primary navigation extends to approximately x=456.5 while the utility controls begin at approximately x=419.2, so the groups overlap by about 37 px. The full wordmark and labelled navigation remain enabled until the existing compact breakpoint at 36rem (576 px). At 576 px the compact icon layout activates and the overlap disappears, which is why smaller phones such as the iPhone 13 mini look acceptable.

The homepage sponsorship disclosure is also unavailable on narrow screens. `SponsorBadge` is deliberately hidden below 72rem, leaving mobile visitors without the sponsorship information that appears elsewhere in the site.

## Goals

- Remove header overlap throughout the 577–620 px transition range.
- Preserve the existing compact phone layout at and below 36rem.
- Keep labelled primary navigation visible for as long as it fits.
- Give narrow-screen homepage visitors a visible sponsorship message without adding another header control.
- Reuse the visual language of the existing sponsorship panels on rankings and graph pages.
- Avoid obstructing the comparison table or consuming persistent vertical space.

## Non-goals

- Redesigning the primary navigation, Options menu, or table controls.
- Changing the desktop `SponsorBadge` disclosure or its 72rem visibility threshold.
- Changing sponsorship placement on rankings, graph, or comparison-detail pages.
- Changing the comparison table's horizontal scrolling or sticky-column behavior.

## Responsive Header Design

Use a staged collapse rather than moving the complete compact layout to a larger breakpoint.

- Between 36rem and 39rem (577–624 px), hide only `.header-brand`, the `GDB-Engines` wordmark. Keep the logo, labelled Rankings/Graph/Compare links, and existing right-side controls.
- At and below 36rem (576 px), retain the current compact behavior: navigation labels are hidden, the home link is logo-only, and the navigation distributes the three icons within the available left-side space.
- Leave the search-field behavior and the special 22rem About-button treatment unchanged.

The 39rem threshold provides a small safety margin: the full layout has clean separation again at approximately 620 px, and at 625 px the uncollapsed layout fits. Hiding only the wordmark in the intermediate range removes roughly 99 px without sacrificing navigation labels.

## Compact Sponsorship Pane

Add a compact variant of the existing `SponsorCTA` component so it shares the established gradient, border, typography, theme colors, and call-to-action styling without duplicating those rules.

The compact content is:

> **Independent graph database research.**  
> Sponsorship keeps GDB-Engines running.  
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

Use a browser geometry assertion before the CSS change to demonstrate the current 580 px overlap, then rerun it after the change. On the homepage, verify that the primary navigation's right edge does not pass the utility group's left edge at 620, 580, 577, 576, 375, 320 px.

Also verify:

- The wordmark is hidden at 620, 580, and 577 px, and visible at 625 px.
- Navigation labels remain visible at 577–624 px and switch to icons at 576 px.
- The compact sponsorship pane is visible at 624 px and below, hidden at 625 px and above, and links to `/sponsor/`.
- The existing desktop sponsor badge remains visible at its current 72rem threshold.
- The pane fits at 320 px without horizontal overflow.
- Light and dark mode screenshots at 580 and 375 px show no collision, clipping, or table-header obstruction.
- The production build completes successfully.

## Alternatives Considered

- Moving the entire icon-only layout to 39rem would fix the collision but remove useful labels earlier than necessary.
- Adding sponsorship to the Options menu would save space but make it less discoverable and mix project support with table configuration.
- A sticky or fixed sponsorship banner would be more prominent but would obscure too much of the comparison table on a small screen.
