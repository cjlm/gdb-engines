/**
 * Turns a RankingFile into the flat list of pages to generate. Each board becomes a page at
 * /rankings/{slug}. Titles use the "X Graph Database Popularity Ranking" convention; meta
 * descriptions include "best / most popular / top" for long-tail SEO.
 */
import type { RankingFile, RankedEngine } from './rankings';

export interface Board {
  slug: string;
  title: string;
  h1: string;
  /** Compact label for cross-page references (e.g. "Overall", "RDF", "Rust", "Cypher"). */
  shortLabel: string;
  blurb: string;
  metaDescription: string;
  engines: RankedEngine[];
  /** Engines on this board flagged 'Insufficient data' (stripped from `engines`). */
  insufficientCount: number;
  /** For breadcrumbs/grouping on the index page. */
  group: 'overall' | 'type' | 'kind' | 'license' | 'query-language' | 'language' | 'movers';
}

const splitInsufficient = (engines: RankedEngine[]): { ranked: RankedEngine[]; insufficientCount: number } => {
  const ranked: RankedEngine[] = [];
  let insufficientCount = 0;
  for (const e of engines) {
    if (e.tier === 'Insufficient data') insufficientCount++;
    else ranked.push(e);
  }
  return { ranked, insufficientCount };
};

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\+\+/g, 'pp')   // C++ -> cpp
    .replace(/#/g, 'sharp')    // C# -> csharp
    .replace(/\//g, '-')       // SQL/PGQ -> sql-pgq
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// Boards we omit on purpose:
//   - byKind.database overlaps almost entirely with the overall board
//   - byImplementationLanguage groups with <3 engines (already filtered upstream)
const SKIP_KIND = new Set(['database']);

// type 'Other' and license-tier 'Other' would both want the slug "other"; relabel the
// license one as "Source-Available" since after the recent metadata fixes it's mostly BSL.
const LICENSE_LABEL: Record<string, string> = {
  Permissive: 'Permissive-Licensed',
  Copyleft: 'Copyleft',
  Proprietary: 'Proprietary',
  Other: 'Source-Available',
};

const TYPE_LABEL: Record<string, string> = {
  RDF: 'RDF',
  'Property Graph': 'Property Graph',
  Multiple: 'Multi-Model',
  Other: 'Specialized',
};

const KIND_LABEL: Record<string, string> = {
  embedded: 'Embedded',
  extension: 'Graph Extension',
  'query-engine': 'Graph Query Engine',
  library: 'Graph Library',
};

const blurbFor = (label: string): string =>
  `The best and most popular ${label.toLowerCase()} graph databases, ranked monthly across adoption, activity, community and research signals. Compare top ${label.toLowerCase()} graph database options.`;

const blurbOverall =
  'The best and most popular graph databases, ranked monthly across adoption, activity, community and research signals. Compare top graph databases used in production today.';

const blurbMovers =
  'Graph databases with the fastest-rising momentum this month, based on recent activity, community engagement and adoption signals.';

/**
 * Maps an SPDX license string to its tier label. Mirrors the rankings repo's
 * licenseTier() so the comparison-table page can link a license to the right board.
 */
function licenseTierLabel(spdx: string | null | undefined): string {
  if (!spdx) return 'Other';
  const lower = spdx.toLowerCase();
  if (lower === 'proprietary') return 'Proprietary';
  for (const tok of ['gpl', 'lgpl', 'agpl', 'sspl', 'eupl', 'osl']) {
    if (lower.includes(tok)) return 'Copyleft';
  }
  const permissiveExact = new Set(['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'mpl-2.0', 'postgresql', 'unlicense', 'zlib']);
  if (permissiveExact.has(lower)) return 'Permissive';
  if (lower.includes('bsd') || lower.includes('apache') || lower.includes('mit')) return 'Permissive';
  return 'Other';
}

/**
 * Pre-computes the maps the comparison-table page needs to (a) link each badge to its
 * ranking page and (b) show the overall rank. Built once per page render.
 */
export function buildLinkMaps(ranking: RankingFile): {
  typeSlug: Map<string, string>;
  kindSlug: Map<string, string>;
  licenseTierSlug: (spdx: string | null | undefined) => string | null;
  queryLanguageSlug: Map<string, string>;
  implementationLanguageSlug: Map<string, string>;
  overallRank: Map<string, number>;
  overallDelta1m: Map<string, number | 'new' | null>;
} {
  const typeSlug = new Map<string, string>();
  for (const k of Object.keys(ranking.byType)) typeSlug.set(k, slugify(TYPE_LABEL[k] ?? k));
  const kindSlug = new Map<string, string>();
  for (const k of Object.keys(ranking.byKind)) {
    if (SKIP_KIND.has(k)) continue;
    kindSlug.set(k, slugify(KIND_LABEL[k] ?? k));
  }
  const licenseTierSlugMap = new Map<string, string>();
  for (const k of Object.keys(ranking.byLicenseTier)) licenseTierSlugMap.set(k, slugify(LICENSE_LABEL[k] ?? k));
  const licenseTierSlug = (spdx: string | null | undefined): string | null => {
    const tier = licenseTierLabel(spdx);
    return licenseTierSlugMap.get(tier) ?? null;
  };
  const queryLanguageSlug = new Map<string, string>();
  for (const k of Object.keys(ranking.byQueryLanguage)) queryLanguageSlug.set(k, slugify(k));
  const implementationLanguageSlug = new Map<string, string>();
  for (const k of Object.keys(ranking.byImplementationLanguage)) implementationLanguageSlug.set(k, slugify(k));
  const overallRank = new Map<string, number>();
  const overallDelta1m = new Map<string, number | 'new' | null>();
  // Rank among engines that actually appear on the public board (Insufficient stripped).
  splitInsufficient(ranking.overall).ranked.forEach((e, i) => {
    overallRank.set(e.slug, i + 1);
    overallDelta1m.set(e.slug, e.rankDelta1m);
  });
  return { typeSlug, kindSlug, licenseTierSlug, queryLanguageSlug, implementationLanguageSlug, overallRank, overallDelta1m };
}

/** openCypher is canonicalised to Cypher in the rankings, so badges should resolve the same way. */
export const canonicalQueryLanguage = (s: string): string => (s === 'openCypher' ? 'Cypher' : s);

export interface EngineRanking { board: Board; rank: number; }

/** Every board an engine appears on, with its rank. Ordered overall→type→kind→license→query→language→movers. */
export function getEngineRanks(boards: Board[], slug: string): EngineRanking[] {
  const out: EngineRanking[] = [];
  for (const b of boards) {
    const i = b.engines.findIndex((e) => e.slug === slug);
    if (i !== -1) out.push({ board: b, rank: i + 1 });
  }
  return out;
}

type BoardMeta = Omit<Board, 'engines' | 'insufficientCount'>;
function makeBoard(meta: BoardMeta, engines: RankedEngine[]): Board {
  const { ranked, insufficientCount } = splitInsufficient(engines);
  return { ...meta, engines: ranked, insufficientCount };
}

export function buildBoards(ranking: RankingFile): Board[] {
  const boards: Board[] = [];

  boards.push(makeBoard({
    slug: 'overall',
    title: 'Graph Database Popularity Ranking',
    h1: 'Graph Database Popularity Ranking',
    shortLabel: 'Overall',
    blurb: blurbOverall,
    metaDescription: blurbOverall,
    group: 'overall',
  }, ranking.overall));

  for (const [type, engines] of Object.entries(ranking.byType)) {
    const label = TYPE_LABEL[type] ?? type;
    boards.push(makeBoard({
      slug: slugify(label),
      title: `${label} Graph Database Popularity Ranking`,
      h1: `${label} Graph Database Popularity Ranking`,
      shortLabel: label,
      blurb: blurbFor(label),
      metaDescription: blurbFor(label),
      group: 'type',
    }, engines));
  }

  for (const [kind, engines] of Object.entries(ranking.byKind)) {
    if (SKIP_KIND.has(kind)) continue;
    const label = KIND_LABEL[kind] ?? kind;
    boards.push(makeBoard({
      slug: slugify(label),
      title: `${label} Popularity Ranking`,
      h1: `${label} Popularity Ranking`,
      shortLabel: label,
      blurb: blurbFor(label),
      metaDescription: blurbFor(label),
      group: 'kind',
    }, engines));
  }

  for (const [tier, engines] of Object.entries(ranking.byLicenseTier)) {
    const label = LICENSE_LABEL[tier] ?? tier;
    boards.push(makeBoard({
      slug: slugify(label),
      title: `${label} Graph Database Popularity Ranking`,
      h1: `${label} Graph Database Popularity Ranking`,
      shortLabel: label,
      blurb: blurbFor(label),
      metaDescription: blurbFor(label),
      group: 'license',
    }, engines));
  }

  for (const [lang, engines] of Object.entries(ranking.byQueryLanguage)) {
    boards.push(makeBoard({
      slug: slugify(lang),
      title: `${lang} Graph Database Popularity Ranking`,
      h1: `${lang} Graph Database Popularity Ranking`,
      shortLabel: lang,
      blurb: blurbFor(lang),
      metaDescription: blurbFor(lang),
      group: 'query-language',
    }, engines));
  }

  for (const [lang, engines] of Object.entries(ranking.byImplementationLanguage)) {
    boards.push(makeBoard({
      slug: slugify(lang),
      title: `${lang} Graph Database Popularity Ranking`,
      h1: `${lang} Graph Database Popularity Ranking`,
      shortLabel: lang,
      blurb: `The best and most popular graph databases written in ${lang}, ranked monthly across adoption, activity, community and research signals. Compare top ${lang} graph database options.`,
      metaDescription: `The best and most popular graph databases written in ${lang}, ranked monthly. Compare top ${lang} graph database options.`,
      group: 'language',
    }, engines));
  }

  boards.push(makeBoard({
    slug: 'movers',
    title: 'Graph Database Movers',
    h1: 'Graph Database Movers',
    shortLabel: 'Movers',
    blurb: blurbMovers,
    metaDescription: blurbMovers,
    group: 'movers',
  }, ranking.movers));

  // De-duplicate any accidental slug collisions across categories (last wins isn't ideal —
  // but with our current label maps there shouldn't be any).
  const seen = new Set<string>();
  return boards.filter((b) => {
    if (seen.has(b.slug)) {
      console.warn(`[rankings] dropping board with duplicate slug "${b.slug}" (group=${b.group})`);
      return false;
    }
    seen.add(b.slug);
    return true;
  });
}
