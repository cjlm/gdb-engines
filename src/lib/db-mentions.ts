/**
 * Links every prose mention of a catalogue engine in a blog post to its profile, with the engine's
 * logo and a hover card.
 *
 * Runs on a post's rendered HTML. Nothing inside a heading, quote, code, figure or aside changes.
 * Matching follows src/lib/blog-mentions.ts: the name or an alias, case-sensitive, as a whole
 * word; names that are also ordinary words (the caller passes LINK_ONLY_NAMES) only count when
 * the post links the engine's profile itself.
 *
 * Links the post already has are handled too:
 * - a link to an engine's profile (`/db/<slug>/`) gets the logo and card;
 * - any other link whose text names an engine (a link to its website, say) keeps its target and
 *   gets the logo before the name and the card beside it.
 * Every appearance is decorated.
 */

export interface LinkableEngine {
  slug: string;
  name: string;
  aliases?: string[];
  /** One short line shown in the card. */
  summary: string;
  /** Overall rank on GDB-Engines, when ranked. */
  rank?: number;
  /** Short facts shown as chips: model, form, licence, year. */
  chips?: string[];
  /** When it was first released, shown as "Since …" in the card's corner. */
  since?: string;
  /** The engine's own website, linked from the card. */
  website?: string;
}

export interface MentionIcon {
  src: string;
  backfill: boolean;
}

/** What a mention carries besides its text: the inline logo and the card. */
export interface MentionExtras {
  icon?: MentionIcon;
  /** Unique id for the card, so the link can point to it with aria-describedby. */
  cardId: string;
  /** How many engines are ranked, for "#3 of 158". */
  rankTotal?: number;
}

export interface MentionLink {
  slug: string;
  text: string;
}

/** Elements whose content is never decorated. */
const SKIP_TAGS = new Set(['code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'figure', 'aside', 'script', 'style']);
const PROFILE_HREF = /href="(?:https:\/\/gdb-engines\.com)?\/db\/([a-z0-9-]+)\/"/;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Whole-word, case-sensitive pattern for an engine's names, longest first. */
function namePattern(engine: LinkableEngine, skipNames: ReadonlySet<string>): RegExp | null {
  const names = [engine.name, ...(engine.aliases ?? [])].filter((name) => name && !skipNames.has(name));
  if (!names.length) return null;
  const alternatives = names.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  return new RegExp(`(?<![\\w-])(?:${alternatives})(?![\\w-])`);
}

function logoHtml(icon: MentionIcon | undefined, size: number, className: string): string {
  if (!icon) return '';
  return `<span class="database-logo ${className}${icon.backfill ? ' database-logo--needs-backfill' : ''}" style="--database-logo-size: ${size}px" aria-hidden="true">` +
    `<img src="${escapeHtml(icon.src)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async"></span>`;
}

/** The card: logo, name, rank, chips, one line of description and links onward. */
export function mentionCardHtml(engine: LinkableEngine, extras: MentionExtras): string {
  const profile = `/db/${engine.slug}/`;
  const rank = engine.rank
    ? `<a class="db-card-rank" href="/rankings/overall/" title="Overall GDB-Engines ranking">#${engine.rank}${extras.rankTotal ? `<small> of ${extras.rankTotal}</small>` : ''}</a>`
    : '';
  const chips = (engine.chips ?? []).map((chip) => `<span class="db-card-chip">${escapeHtml(chip)}</span>`).join('');
  const website = engine.website
    ? `<a class="db-card-link" href="${escapeHtml(engine.website)}" rel="noopener" target="_blank">Website ↗</a>`
    : '';
  const since = engine.since ? `<span class="db-card-since">Since ${escapeHtml(engine.since)}</span>` : '';
  return `<span class="db-card" id="${escapeHtml(extras.cardId)}">` +
    `<span class="db-card-head">${logoHtml(extras.icon, 28, 'db-card-logo')}<a class="db-card-name" href="${profile}">${escapeHtml(engine.name)}</a>${rank}</span>` +
    (chips ? `<span class="db-card-chips">${chips}</span>` : '') +
    `<span class="db-card-desc">${escapeHtml(engine.summary)}</span>` +
    `<span class="db-card-links"><a class="db-card-link" href="${profile}">Profile →</a>${website}${since}</span>` +
    `</span>`;
}

const wrap = (anchor: string, card: string): string => `<span class="db-mention-wrap">${anchor}${card}</span>`;

/** Add a class and aria-describedby to an existing opening <a> tag. */
function decorateOpenTag(tag: string, cardId: string): string {
  return tag.replace(/^<a\b/, `<a class="db-mention" aria-describedby="${escapeHtml(cardId)}"`);
}

interface Candidate {
  engine: LinkableEngine;
  pattern: RegExp | null;
}

/**
 * Decorate every appearance of each engine. Returns the new HTML and the mentions decorated, in
 * order of appearance.
 */
export function linkEngineMentions(
  html: string,
  engines: LinkableEngine[],
  extrasFor: (engine: LinkableEngine) => MentionExtras,
  skipNames: ReadonlySet<string> = new Set(),
): { html: string; linked: MentionLink[] } {
  const candidates: Candidate[] = engines.map((engine) => ({ engine, pattern: namePattern(engine, skipNames) }));
  const bySlug = new Map(candidates.map((p) => [p.engine.slug, p]));
  const linked: MentionLink[] = [];
  const take = (p: Candidate, text: string) => {
    linked.push({ slug: p.engine.slug, text });
    return extrasFor(p.engine);
  };
  const firstMatch = (text: string) => {
    let best: { p: Candidate; index: number; match: string } | null = null;
    for (const p of candidates) {
      const m = p.pattern?.exec(text);
      if (m && (!best || m.index < best.index || (m.index === best.index && m[0].length > best.match.length))) {
        best = { p, index: m.index, match: m[0] };
      }
    }
    return best;
  };

  const decorateExistingLink = (open: string, inner: string, close: string): string => {
    const plain = open + inner + close;
    const profileSlug = open.match(PROFILE_HREF)?.[1];
    if (profileSlug) {
      const p = bySlug.get(profileSlug);
      if (!p) return plain;
      const extras = take(p, inner.replace(/<[^>]+>/g, ''));
      const anchor = decorateOpenTag(open, extras.cardId).replace(PROFILE_HREF, `href="/db/${profileSlug}/"`) +
        logoHtml(extras.icon, 14, 'db-mention-logo') + inner + close;
      return wrap(anchor, mentionCardHtml(p.engine, extras));
    }
    // Another link: decorate it when its plain text names an engine, keeping its target.
    if (inner.includes('<')) return plain;
    const best = firstMatch(inner);
    if (!best) return plain;
    const extras = take(best.p, best.match);
    const anchor = decorateOpenTag(open, extras.cardId) + inner.slice(0, best.index) +
      logoHtml(extras.icon, 14, 'db-mention-logo') + inner.slice(best.index) + close;
    return wrap(anchor, mentionCardHtml(best.p.engine, extras));
  };

  const parts = html.split(/(<[^>]+>)/);
  const out: string[] = [];
  const skipStack: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (part.startsWith('<')) {
      const tag = part.match(/^<\/?\s*([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase();
      if (tag === 'a' && !part.startsWith('</') && !skipStack.length) {
        // Collect the whole link and decide on it as a unit.
        let j = i + 1;
        while (j < parts.length && !/^<\/a\s*>$/i.test(parts[j] ?? '')) j++;
        out.push(decorateExistingLink(part, parts.slice(i + 1, j).join(''), parts[j] ?? '</a>'));
        i = j;
        continue;
      }
      if (tag && SKIP_TAGS.has(tag) && !part.endsWith('/>')) {
        if (part.startsWith('</')) {
          const at = skipStack.lastIndexOf(tag);
          if (at >= 0) skipStack.splice(at, 1);
        } else {
          skipStack.push(tag);
        }
      }
      out.push(part);
      continue;
    }
    if (skipStack.length || !candidates.length || !part.trim()) {
      out.push(part);
      continue;
    }
    let text = part;
    let result = '';
    for (let best = firstMatch(text); best; best = firstMatch(text)) {
      const extras = take(best.p, best.match);
      const anchor = `<a class="db-mention" href="/db/${best.p.engine.slug}/" aria-describedby="${escapeHtml(extras.cardId)}">` +
        `${logoHtml(extras.icon, 14, 'db-mention-logo')}${best.match}</a>`;
      result += text.slice(0, best.index) + wrap(anchor, mentionCardHtml(best.p.engine, extras));
      text = text.slice(best.index + best.match.length);
    }
    out.push(result + text);
  }
  return { html: out.join(''), linked };
}

/** The card's line for an engine: its description's first sentence, kept short. */
export function engineSummary(description: string, maxLength = 140): string {
  const first = description.split(/(?<=\.)\s/)[0] ?? description;
  return first.length > maxLength ? `${first.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…` : first;
}
