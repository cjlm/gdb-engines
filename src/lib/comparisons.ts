/**
 * Selection and slug rules for the `/compare/` surface.
 *
 * Pair pages are pre-generated from a popularity-weighted subset of the catalogue rather
 * than all C(143,2) = 10,153 combinations: publishing ~10k near-duplicate pages on a
 * low-traffic site is index bloat, and it would drag the pages that do rank. Everything
 * outside the selected set still resolves through the client-side builder.
 *
 * All three thresholds are constants here. Raising them is the only change needed to grow
 * the surface — see docs/design/comparison-pages.md §1.3.
 */
import type { RankingFile } from './rankings';

/** All-pairs among the top N engines by overall rank. */
export const PEER_DEPTH = 24;
/** Top M engines paired against the whole catalogue. */
export const ANCHOR_DEPTH = 0;
/** The token that separates the two slugs in a pair slug. */
export const VS = '-vs-';

export interface Pair {
  a: string;
  b: string;
  /** `${a}-vs-${b}` with a < b alphabetically. */
  slug: string;
}

export interface ComparableDb {
  slug: string;
  features?: unknown;
}

export interface SelectPairsOptions {
  peerDepth?: number;
  anchorDepth?: number;
  /** Drop pairs where neither side carries a `[features]` block. */
  requireSurveyed?: boolean;
}

/**
 * Well-known pairs used when no ranking data is available (no RANKINGS_TOKEN and no
 * sibling checkout). The site already builds without rankings; comparisons follow suit.
 */
const SEED_PAIRS: [string, string][] = [
  ['neo4j', 'memgraph'],
  ['neo4j', 'arangodb'],
  ['neo4j', 'janusgraph'],
  ['neo4j', 'neptune'],
  ['neo4j', 'tigergraph'],
  ['neo4j', 'falkordb'],
  ['neo4j', 'nebula-graph'],
  ['neo4j', 'orientdb'],
  ['neo4j', 'dgraph'],
  ['neo4j', 'virtuoso'],
  ['memgraph', 'falkordb'],
  ['memgraph', 'arangodb'],
  ['arangodb', 'orientdb'],
  ['janusgraph', 'neptune'],
  ['janusgraph', 'nebula-graph'],
  ['tigergraph', 'nebula-graph'],
  ['dgraph', 'arangodb'],
  ['virtuoso', 'graphdb'],
  ['graphdb', 'stardog'],
  ['blazegraph', 'virtuoso'],
];

/** Canonical pair slug: the two slugs sorted alphabetically, joined with `-vs-`. */
export function pairSlug(x: string, y: string): string {
  const [a, b] = x < y ? [x, y] : [y, x];
  return `${a}${VS}${b}`;
}

/** Splits a pair slug back into its two engine slugs, or null if it is not one. */
export function parsePairSlug(slug: string): { a: string; b: string } | null {
  const parts = slug.split(VS);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { a: parts[0], b: parts[1] };
}

function makePair(x: string, y: string): Pair {
  const [a, b] = x < y ? [x, y] : [y, x];
  return { a, b, slug: `${a}${VS}${b}` };
}

/**
 * The pre-generated pair set.
 *
 * Set A: all pairs among the top `peerDepth` engines by overall rank.
 * Set B: each of the top `anchorDepth` engines paired with the whole catalogue.
 * Then the coverage gate: at least one side must carry survey feature scores.
 */
export function selectPairs(
  ranking: RankingFile | null,
  databases: ComparableDb[],
  opts: SelectPairsOptions = {}
): Pair[] {
  const peerDepth = opts.peerDepth ?? PEER_DEPTH;
  const anchorDepth = opts.anchorDepth ?? ANCHOR_DEPTH;
  const requireSurveyed = opts.requireSurveyed ?? true;

  const known = new Set(databases.map((d) => d.slug));
  const surveyed = new Set(databases.filter((d) => d.features).map((d) => d.slug));

  // A future slug containing the pair separator would make `/compare/<a>-vs-<b>/` ambiguous.
  for (const slug of known) {
    if (slug.includes(VS)) {
      throw new Error(`Database slug "${slug}" contains "${VS}", which collides with the pair URL scheme.`);
    }
  }

  const bySlug = new Map<string, Pair>();
  const add = (x: string, y: string) => {
    if (x === y || !known.has(x) || !known.has(y)) return;
    if (requireSurveyed && !surveyed.has(x) && !surveyed.has(y)) return;
    const pair = makePair(x, y);
    bySlug.set(pair.slug, pair);
  };

  if (!ranking) {
    for (const [x, y] of SEED_PAIRS) add(x, y);
    return [...bySlug.values()].sort((p, q) => p.slug.localeCompare(q.slug));
  }

  const ranked = ranking.overall.filter((e) => e.tier !== 'Insufficient data').map((e) => e.slug);

  const peers = ranked.slice(0, peerDepth);
  for (let i = 0; i < peers.length; i += 1) {
    for (let j = i + 1; j < peers.length; j += 1) {
      add(peers[i]!, peers[j]!);
    }
  }

  for (const anchor of ranked.slice(0, anchorDepth)) {
    for (const db of databases) {
      add(anchor, db.slug);
    }
  }

  return [...bySlug.values()].sort((p, q) => p.slug.localeCompare(q.slug));
}

/** slug -> 1-based overall rank, excluding engines with insufficient data. */
export function buildOverallRankMap(ranking: RankingFile | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!ranking) return map;
  let rank = 0;
  for (const engine of ranking.overall) {
    if (engine.tier === 'Insufficient data') continue;
    rank += 1;
    map.set(engine.slug, rank);
  }
  return map;
}

/** slug -> the ranked engine record, for score/tier/pillar lookups. */
export function buildRankedMap(ranking: RankingFile | null): Map<string, RankingFile['overall'][number]> {
  const map = new Map<string, RankingFile['overall'][number]>();
  if (!ranking) return map;
  for (const engine of ranking.overall) map.set(engine.slug, engine);
  return map;
}
