/**
 * Turns a RankingFile plus catalogue metadata into the flat list of pages to generate. Each
 * board becomes a page at /rankings/{slug}. Only /rankings/overall/ targets the generic head
 * terms; sub-boards lead with their qualifier so they stop competing with it, and with each
 * other.
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
  /** Whether this board is linked from the rankings directory. Direct URLs remain valid. */
  listed: boolean;
  /** For breadcrumbs/grouping on the index page. */
  group: 'overall' | 'type' | 'kind' | 'license' | 'query-language' | 'language' | 'segment' | 'movers';
}

/**
 * The small amount of catalogue metadata needed to build editorial ranking segments.
 * Keep this separate from Astro's collection type so the ranking builder stays reusable
 * from the OG image endpoint and from page routes.
 */
export interface CatalogueRankingMeta {
  slug: string;
  kind?: string;
  status?: string;
  protocols?: readonly string[];
  description?: string;
  ai_roles?: readonly string[];
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

// These boards remain available as stable direct URLs, but are not useful entry points
// from the rankings directory: Specialized is a catch-all for the `Other` type, while
// Custom API describes an integration surface rather than a query language.
const HIDE_FROM_RANKINGS_INDEX = {
  type: new Set(['Specialized']),
  queryLanguage: new Set(['Custom API']),
};

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

const POSTGRES_PROTOCOL = 'PostgreSQL wire';

/**
 * These are graph layers whose primary value is querying or extending relational data,
 * rather than operating as a separate native graph store. The extension half is discovered
 * from the catalogue description below; these entries are the non-extension graph layers
 * whose existing metadata expresses the same user-facing use case.
 */
const RELATIONAL_GRAPH_LAYER_OVERRIDES = new Set([
  'agensgraph',
  'bigquery-graph',
  'ontop',
  'postgresql-sql-pgq',
  'prometheux',
  'puppygraph',
  'relationalai',
  'spanner-graph',
  'typegraph',
]);

const isActiveCatalogueEntry = (db: CatalogueRankingMeta): boolean =>
  db.status !== 'inactive' && db.status !== 'deprecated';

const isPostgresGraphExtension = (db: CatalogueRankingMeta): boolean =>
  isActiveCatalogueEntry(db) && db.kind === 'extension' && db.protocols?.includes(POSTGRES_PROTOCOL) === true;

const isGraphOverRelational = (db: CatalogueRankingMeta): boolean =>
  isActiveCatalogueEntry(db) && (
    RELATIONAL_GRAPH_LAYER_OVERRIDES.has(db.slug) ||
    (db.kind === 'extension' && /\b(?:postgres(?:ql)?|duckdb|sqlite)\b/i.test(db.description ?? ''))
  );

// Do not infer these boards from generic AI, vector, or graph language. `ai_roles` is a
// curated product-role classification, kept separate from the monthly ranking data.
const hasAiRole = (db: CatalogueRankingMeta, role: 'agent-memory' | 'graphrag'): boolean =>
  isActiveCatalogueEntry(db) && db.ai_roles?.includes(role) === true;

const isAgentMemory = (db: CatalogueRankingMeta): boolean => hasAiRole(db, 'agent-memory');
const isGraphRag = (db: CatalogueRankingMeta): boolean => hasAiRole(db, 'graphrag');

interface SegmentDefinition {
  slug: string;
  title: string;
  h1: string;
  shortLabel: string;
  blurb: string;
  listed?: boolean;
  match: (db: CatalogueRankingMeta) => boolean;
}

const SEGMENTS: SegmentDefinition[] = [
  {
    slug: 'postgresql-graph-extensions',
    title: 'PostgreSQL Graph Extensions, Ranked Monthly',
    h1: 'PostgreSQL Graph Extensions, Ranked Monthly',
    shortLabel: 'PostgreSQL Extensions',
    blurb: 'Graph extensions that run inside PostgreSQL or a PostgreSQL-compatible engine, ranked monthly across adoption, activity, community and research signals.',
    match: isPostgresGraphExtension,
  },
  {
    slug: 'graph-layers-relational-databases',
    title: 'Graph Layers for Relational Databases, Ranked Monthly',
    h1: 'Graph Layers for Relational Databases, Ranked Monthly',
    shortLabel: 'Relational Graph Layers',
    blurb: 'Graph layers that add graph capabilities to relational databases or query relational tables in place, ranked monthly across adoption, activity, community and research signals.',
    match: isGraphOverRelational,
  },
  {
    slug: 'graph-databases-agent-memory',
    title: 'Graph Systems for Agent Memory, Ranked Monthly',
    h1: 'Graph Systems for Agent Memory, Ranked Monthly',
    shortLabel: 'Agent Memory',
    blurb: 'Graph systems used as memory and context stores for AI agents. Monthly ranking by adoption, activity, community, and research.',
    match: isAgentMemory,
  },
  {
    slug: 'graph-databases-graphrag-knowledge-grounding',
    title: 'Graph Systems for GraphRAG & Knowledge Grounding, Ranked Monthly',
    h1: 'Graph Systems for GraphRAG & Knowledge Grounding, Ranked Monthly',
    shortLabel: 'GraphRAG & Grounding',
    blurb: 'Graph systems used for GraphRAG and to ground AI responses in structured knowledge. Monthly ranking by adoption, activity, community, and research.',
    match: isGraphRag,
  },
  {
    // Keep the original URL as an unlisted umbrella page for existing links.
    slug: 'graph-databases-ai-agents',
    title: 'Graph Systems for AI, Ranked Monthly',
    h1: 'Graph Systems for AI, Ranked Monthly',
    shortLabel: 'AI Graphs',
    blurb: 'Graph systems used for agent memory, GraphRAG, or knowledge grounding. Monthly ranking by adoption, activity, community, and research.',
    listed: false,
    match: (db) => isAgentMemory(db) || isGraphRag(db),
  },
];

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
  for (const b of boards.filter((board) => board.listed)) {
    const i = b.engines.findIndex((e) => e.slug === slug);
    if (i !== -1) out.push({ board: b, rank: i + 1 });
  }
  return out;
}

type BoardMeta = Omit<Board, 'engines' | 'insufficientCount' | 'listed'> & { listed?: boolean };
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
  return { ...meta, listed: meta.listed ?? true, metaDescription, engines: ranked, insufficientCount };
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

export function buildBoards(ranking: RankingFile, catalogue: readonly CatalogueRankingMeta[] = []): Board[] {
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
      listed: !HIDE_FROM_RANKINGS_INDEX.type.has(label),
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

  // Editorial segments use the same monthly score as every other board, but their
  // membership comes from catalogue metadata rather than a field already present in
  // ranking.json. Keeping the matchers here makes it easy to add the next landscape
  // segment without creating a second ranking page template or data format.
  if (catalogue.length > 0) {
    for (const segment of SEGMENTS) {
      const eligible = new Set(
        catalogue.filter(segment.match).map((db) => db.slug)
      );
      const engines = ranking.overall.filter((engine) => eligible.has(engine.slug));
      if (engines.length === 0) continue;
      boards.push(makeBoard({
        slug: segment.slug,
        title: segment.title,
        h1: segment.h1,
        shortLabel: segment.shortLabel,
        blurb: segment.blurb,
        metaDescription: segment.blurb,
        listed: segment.listed,
        group: 'segment',
      }, engines));
    }
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
      listed: !HIDE_FROM_RANKINGS_INDEX.queryLanguage.has(lang),
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
  const exemptFromFloor = new Set(['overall', 'movers', 'query-language', 'segment']);
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
