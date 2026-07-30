/**
 * Turns a RankingFile into the flat list of pages to generate. Each board becomes a page at
 * /rankings/{slug}. Only /rankings/overall/ targets the generic head terms; sub-boards lead
 * with their qualifier so they stop competing with it, and with each other.
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
//   - byKind.library ranks a toolkit set nobody searches as a ranking (90 days of
//     Search Console to 2026-07-29: zero impressions, zero clicks)
//   - byImplementationLanguage groups below the upstream MIN_LANGUAGE_ENGINES floor
const SKIP_KIND = new Set(['database', 'library']);

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
  `${label} graph databases, ranked monthly by adoption, activity, community and research signals.`;

const blurbOverall =
  'The most popular graph databases, ranked monthly across adoption, activity, community and research signals.';

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
  // Only link to boards that survive the group and size gates in buildBoards, so a
  // retired board never leaves a dangling /rankings/<slug>/ link behind on a value.
  const live = new Set(buildBoards(ranking).map((b) => b.slug));
  const linkable = (label: string): string | null => {
    const slug = slugify(label);
    return live.has(slug) ? slug : null;
  };
  const mapFor = (keys: string[], label: (k: string) => string): Map<string, string> => {
    const out = new Map<string, string>();
    for (const k of keys) {
      const slug = linkable(label(k));
      if (slug) out.set(k, slug);
    }
    return out;
  };
  const typeSlug = mapFor(Object.keys(ranking.byType), (k) => TYPE_LABEL[k] ?? k);
  const kindSlug = mapFor(
    Object.keys(ranking.byKind).filter((k) => !SKIP_KIND.has(k)),
    (k) => KIND_LABEL[k] ?? k
  );
  const licenseTierSlug = (spdx: string | null | undefined): string | null => {
    const tier = licenseTierLabel(spdx);
    return linkable(LICENSE_LABEL[tier] ?? tier);
  };
  const queryLanguageSlug = mapFor(Object.keys(ranking.byQueryLanguage), (k) => k);
  const implementationLanguageSlug = mapFor(Object.keys(ranking.byImplementationLanguage), (k) => k);
  const overallRank = new Map<string, number>();
  const overallDelta1m = new Map<string, number | 'new' | null>();
  // Rank among engines that actually appear on the public board (Insufficient stripped).
  splitInsufficient(ranking.overall).ranked.forEach((e, i) => {
    overallRank.set(e.slug, i + 1);
    overallDelta1m.set(e.slug, e.rankDelta1m);
  });
  return { typeSlug, kindSlug, licenseTierSlug, queryLanguageSlug, implementationLanguageSlug, overallRank, overallDelta1m };
}

/**
 * Canonical query-language labels, so variant spellings resolve to the same ranking board and badge.
 * `openCypher` → `Cypher`; `ISO GQL` → `GQL` (the ISO/IEC 39075 standard name). This is the single
 * normalization point for query-language labels; keep it in sync with the rankings collector.
 */
const QUERY_LANGUAGE_ALIASES: Record<string, string> = {
  openCypher: 'Cypher',
  'ISO GQL': 'GQL',
};
export const canonicalQueryLanguage = (s: string): string => QUERY_LANGUAGE_ALIASES[s] ?? s;

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
  // Enrich the meta description with the top-3 engines for this board, so each ranking
  // page presents a unique summary to search engines and AI systems (anti-boilerplate).
  // Movers board is momentum-based, not score-based — different framing.
  const top3 = ranked.slice(0, 3).map((e) => e.name);
  let metaDescription = meta.metaDescription;
  if (top3.length >= 3 && meta.group !== 'movers') {
    metaDescription = `${meta.metaDescription.replace(/\s+Compare top.*$/, '')} Currently led by ${top3[0]}, ${top3[1]}, and ${top3[2]}.`;
  } else if (top3.length >= 3 && meta.group === 'movers') {
    metaDescription = `${meta.metaDescription} Top movers: ${top3.join(', ')}.`;
  }
  return { ...meta, metaDescription, engines: ranked, insufficientCount };
}

// Build "{label} Graph Database Popularity Ranking", avoiding the duplicate-word
// "Property Graph Graph Database" when the label already ends in "Graph".
//
// Sub-boards lead with their qualifier and end "Ranked Monthly" rather than
// repeating "Graph Database Popularity Ranking", which 30 pages were bidding for
// against /rankings/overall/. Search Console showed nine of them splitting the
// impressions for "graph database ranking" while overall (position 4) got two.
function gdbRankingTitle(label: string): string {
  const trimmed = label.endsWith(' Graph') ? label.slice(0, -' Graph'.length) : label;
  return `${trimmed} Graph Databases, Ranked Monthly`;
}

// A board needs enough engines for the ordering to mean anything. Set at 15 on the
// evidence rather than by feel: C (10 engines) drew 393 impressions across 52 queries
// in the 90 days to 2026-07-29 and not one was about C — they were "best graph
// database", "top graph databases", "db engines ranking", all at position 43-91. It had
// become the site's generic-head-term page, competing with /rankings/overall/ and
// winning nothing. Rust (19) is the smallest board that actually wins its own queries
// ("rust graph database", "graph database rust", positions 9-12).
//
// Query language is exempt: it is how people shop for an engine, and it carries the
// best-performing board on the site, so emerging standards stay in below the floor.
const MIN_BOARD_ENGINES = 15;

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
      title: gdbRankingTitle(label),
      h1: gdbRankingTitle(label),
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

  // The license group is retired: four boards, 71 impressions and zero clicks over the
  // 90 days to 2026-07-29. Ranking 71 of 143 engines by "permissive licence" was never a
  // question anyone asked, and the pages competed with the overall board for head terms.
  // License remains a sortable column on the homepage.

  for (const [lang, engines] of Object.entries(ranking.byQueryLanguage)) {
    boards.push(makeBoard({
      slug: slugify(lang),
      title: gdbRankingTitle(lang),
      h1: gdbRankingTitle(lang),
      shortLabel: lang,
      blurb: blurbFor(lang),
      metaDescription: blurbFor(lang),
      group: 'query-language',
    }, engines));
  }

  for (const [lang, engines] of Object.entries(ranking.byImplementationLanguage)) {
    boards.push(makeBoard({
      slug: slugify(lang),
      title: gdbRankingTitle(lang),
      h1: gdbRankingTitle(lang),
      shortLabel: lang,
      blurb: `Graph databases implemented in ${lang}, ranked monthly across adoption, activity, community and research signals.`,
      metaDescription: `Graph databases implemented in ${lang}, ranked monthly across adoption, activity, community and research signals.`,
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
  const exemptFromFloor = new Set(['overall', 'movers', 'query-language']);
  return boards.filter((b) => {
    if (seen.has(b.slug)) {
      console.warn(`[rankings] dropping board with duplicate slug "${b.slug}" (group=${b.group})`);
      return false;
    }
    if (!exemptFromFloor.has(b.group) && b.engines.length < MIN_BOARD_ENGINES) return false;
    seen.add(b.slug);
    return true;
  });
}
