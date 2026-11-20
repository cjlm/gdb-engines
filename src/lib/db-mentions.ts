/**
 * Links the first prose mention of each catalogue engine in a blog post to its profile.
 *
 * Runs on a post's rendered HTML. Only text in running prose is touched: nothing inside a
 * link, code, a heading, a quote, a figure or an aside changes, and an engine the post already
 * links to (`/db/<slug>/`) is left alone. Matching follows src/lib/blog-mentions.ts: the name or
 * an alias, case-sensitive, as a whole word; names that are also ordinary words (the caller
 * passes LINK_ONLY_NAMES from blog-mentions.ts) are never linked automatically.
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
}

export interface MentionIcon {
  src: string;
  backfill: boolean;
}

/** What a link carries besides its text: the inline logo and the hover card. */
export interface MentionExtras {
  icon?: MentionIcon;
  /** Unique id for the card, so the link can point to it with aria-describedby. */
  cardId: string;
  /** How many engines are ranked, for "#3 of 158". */
  rankTotal?: number;
}

/** Elements whose text is never linked. */
const SKIP_TAGS = new Set(['a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'figure', 'aside', 'script', 'style']);

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeAttr = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Candidate {
  engine: LinkableEngine;
  pattern: RegExp;
}

function candidates(engines: LinkableEngine[], html: string, skipNames: ReadonlySet<string>): Candidate[] {
  const out: Candidate[] = [];
  for (const engine of engines) {
    if (html.includes(`/db/${engine.slug}/`) || html.includes(`/db/${engine.slug}"`)) continue;
    const names = [engine.name, ...(engine.aliases ?? [])].filter((name) => name && !skipNames.has(name));
    if (!names.length) continue;
    // Longest names first, so "Neo4j Aura" wins over "Neo4j" at the same position.
    const alternatives = names.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
    out.push({ engine, pattern: new RegExp(`(?<![\\w-])(?:${alternatives})(?![\\w-])`) });
  }
  return out;
}

export interface MentionLink {
  slug: string;
  text: string;
}

/**
 * Wrap the first prose mention of each engine in a link. `render` builds the link's HTML so the
 * caller decides icons and tooltips.
 *
 * Returns the new HTML and the engines it linked, in order of appearance.
 */
export function linkEngineMentions(
  html: string,
  engines: LinkableEngine[],
  render: (engine: LinkableEngine, text: string) => string,
  skipNames: ReadonlySet<string> = new Set(),
): { html: string; linked: MentionLink[] } {
  let pending = candidates(engines, html, skipNames);
  const linked: MentionLink[] = [];
  const skipStack: string[] = [];
  const parts = html.split(/(<[^>]+>)/);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (part.startsWith('<')) {
      const tag = part.match(/^<\/?\s*([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase();
      if (tag && SKIP_TAGS.has(tag) && !part.endsWith('/>')) {
        if (part.startsWith('</')) {
          const at = skipStack.lastIndexOf(tag);
          if (at >= 0) skipStack.splice(at, 1);
        } else {
          skipStack.push(tag);
        }
      }
      continue;
    }
    if (skipStack.length || !pending.length || !part.trim()) continue;
    let text = part;
    let result = '';
    for (;;) {
      let best: { candidate: Candidate; index: number; match: string } | null = null;
      for (const candidate of pending) {
        const m = candidate.pattern.exec(text);
        if (m && (!best || m.index < best.index || (m.index === best.index && m[0].length > best.match.length))) {
          best = { candidate, index: m.index, match: m[0] };
        }
      }
      if (!best) break;
      result += text.slice(0, best.index) + render(best.candidate.engine, best.match);
      text = text.slice(best.index + best.match.length);
      linked.push({ slug: best.candidate.engine.slug, text: best.match });
      const done = best.candidate;
      pending = pending.filter((c) => c !== done);
    }
    parts[i] = result + text;
  }
  return { html: parts.join(''), linked };
}

const PROFILE_LINK = /<a href="(?:https:\/\/gdb-engines\.com)?\/db\/([a-z0-9-]+)\/">/g;

/**
 * Give links the post already makes to engine profiles the same logo and tooltip as automatic
 * ones. Links to engines missing from `engines` are left as they are.
 */
export function decorateProfileLinks(
  html: string,
  engines: LinkableEngine[],
  extras: (engine: LinkableEngine) => MentionExtras,
): string {
  const bySlug = new Map(engines.map((engine) => [engine.slug, engine]));
  return html.replace(PROFILE_LINK, (tag, slug: string) => {
    const engine = bySlug.get(slug);
    if (!engine) return tag;
    return mentionOpenTag(engine, extras(engine));
  });
}

/** Slugs of the engines whose profiles the post already links to. */
export function linkedProfileSlugs(html: string): string[] {
  return [...html.matchAll(PROFILE_LINK)].map((m) => m[1] ?? '');
}

/** The tooltip line for an engine: its description's first sentence, kept short. */
export function engineSummary(description: string, maxLength = 140): string {
  const first = description.split(/(?<=\.)\s/)[0] ?? description;
  const line = first.length > maxLength ? `${first.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…` : first;
  return line;
}

function logoHtml(icon: MentionIcon | undefined, size: number, className: string): string {
  if (!icon) return '';
  return `<span class="database-logo ${className}${icon.backfill ? ' database-logo--needs-backfill' : ''}" style="--database-logo-size: ${size}px" aria-hidden="true">` +
    `<img src="${escapeAttr(icon.src)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async"></span>`;
}

/** The hover card: logo, name, rank, chips and a one-line description. */
export function mentionCardHtml(engine: LinkableEngine, extras: MentionExtras): string {
  const rank = engine.rank
    ? `<span class="db-card-rank" title="Overall GDB-Engines ranking">#${engine.rank}${extras.rankTotal ? `<small> of ${extras.rankTotal}</small>` : ''}</span>`
    : '';
  const chips = (engine.chips ?? []).map((chip) => `<span class="db-card-chip">${escapeAttr(chip)}</span>`).join('');
  return `<span class="db-card" id="${escapeAttr(extras.cardId)}" role="tooltip">` +
    `<span class="db-card-head">${logoHtml(extras.icon, 28, 'db-card-logo')}<span class="db-card-name">${escapeAttr(engine.name)}</span>${rank}</span>` +
    (chips ? `<span class="db-card-chips">${chips}</span>` : '') +
    `<span class="db-card-desc">${escapeAttr(engine.summary)}</span>` +
    `<span class="db-card-more">View profile →</span>` +
    `</span>`;
}

/** Opening tag of a mention link, followed by its inline logo and hover card. */
function mentionOpenTag(engine: LinkableEngine, extras: MentionExtras): string {
  return `<a class="db-mention" href="/db/${engine.slug}/" aria-describedby="${escapeAttr(extras.cardId)}">` +
    `${mentionCardHtml(engine, extras)}${logoHtml(extras.icon, 14, 'db-mention-logo')}`;
}

/** Link markup for an automatic mention. */
export function mentionLinkHtml(engine: LinkableEngine, text: string, extras: MentionExtras): string {
  return `${mentionOpenTag(engine, extras)}${text}</a>`;
}
