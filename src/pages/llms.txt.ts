import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { featureCount } from '../data/feature-metadata';
import { loadRankings } from '../lib/rankings';
import { pregeneratedPairList, buildOverallRankMap } from '../lib/comparisons';

/** How many head-to-head pages llms.txt names outright. The set has 1,455. */
const REPRESENTATIVE_PAIRS = 12;

/**
 * The pairs most worth naming: lowest combined overall rank, so the list is the dozen
 * head-to-heads a reader is most likely to want and the shape of the other 1,443 is
 * obvious from them.
 */
async function representativePairs(): Promise<string> {
  const [ranking, databases] = await Promise.all([loadRankings(), getCollection('databases')]);
  const ranks = buildOverallRankMap(ranking);
  const nameBySlug = new Map(databases.map((d) => [d.data.slug, d.data.name]));
  const rank = (slug: string): number => ranks.get(slug) ?? Number.POSITIVE_INFINITY;

  return pregeneratedPairList(
    ranking,
    databases.map((d) => ({ slug: d.data.slug, features: d.data.features }))
  )
    .filter((p) => Number.isFinite(rank(p.a)) && Number.isFinite(rank(p.b)))
    .sort((p, q) => rank(p.a) + rank(p.b) - (rank(q.a) + rank(q.b)) || p.slug.localeCompare(q.slug))
    .slice(0, REPRESENTATIVE_PAIRS)
    .map(
      (p) =>
        `- [${nameBySlug.get(p.a) ?? p.a} vs ${nameBySlug.get(p.b) ?? p.b}](https://gdb-engines.com/compare/${p.slug}/)`
    )
    .join('\n');
}

export const GET: APIRoute = async () =>
  new Response(
    `# GDB-Engines

> Open-source comparison and monthly popularity ranking of 131+ graph databases, query engines, extensions, and embedded libraries. Covers property graph (LPG), RDF, and multi-model engines. Feature scores derived from peer-reviewed academic research; popularity rankings blended monthly across adoption, activity, community and research signals from public sources.

## Comparison

- [Homepage](https://gdb-engines.com/): Interactive comparison of 131+ graph databases with ${featureCount} academic feature scores, license, query languages, implementation language, and overall popularity rank.
- [About](https://gdb-engines.com/about): Methodology, data model, contribution guidelines, changelog.
- [JSON API](https://gdb-engines.com/api.json): Full dataset.

## Rankings

- [Overall ranking](https://gdb-engines.com/rankings/overall/): Top graph databases by blended score, refreshed monthly.
- [Movers](https://gdb-engines.com/rankings/movers/): Engines with the fastest-rising momentum month-over-month.
- [Rankings index](https://gdb-engines.com/rankings/): All boards split by data model, engine kind, license, query language, and implementation language.

## Comparisons

Side-by-side comparisons: catalogue fields, monthly rank and the ${featureCount} survey feature scores. No winner is declared and no score is summed into a verdict.

- [Comparison directory](https://gdb-engines.com/compare/): All published comparisons, by segment and by pair.
- [Open source graph databases compared](https://gdb-engines.com/compare/open-source-graph-databases/)
- [Open source Cypher graph databases compared](https://gdb-engines.com/compare/open-source-cypher-databases/)
- [C++ graph databases compared](https://gdb-engines.com/compare/cpp-graph-databases/)
- [Rust graph databases compared](https://gdb-engines.com/compare/rust-graph-databases/)
- [Enterprise graph platforms compared](https://gdb-engines.com/compare/enterprise-graph-platforms/)
- [Established graph databases compared](https://gdb-engines.com/compare/established-graph-databases/)
- [RDF triplestores compared](https://gdb-engines.com/compare/rdf-triplestores/)
- [Java graph databases compared](https://gdb-engines.com/compare/java-graph-databases/)
- [Gremlin graph databases compared](https://gdb-engines.com/compare/gremlin-graph-databases/)
- [Multi-model graph databases compared](https://gdb-engines.com/compare/multi-model-graph-databases/)
- [Embedded graph databases compared](https://gdb-engines.com/compare/embedded-graph-databases/)
- [GQL graph databases compared](https://gdb-engines.com/compare/gql-graph-databases/)
- [Graph query engines compared](https://gdb-engines.com/compare/graph-query-engines/)
- [Graph database extensions compared](https://gdb-engines.com/compare/graph-database-extensions/)

Head-to-head pages follow the pattern \`https://gdb-engines.com/compare/<a>-vs-<b>/\` with the
two catalogue slugs in alphabetical order. The twelve whose two engines rank highest overall:

${await representativePairs()}

## Source

- [GitHub repository](https://github.com/cjlm/gdb-engines): Source TOML data + Astro site, open to contributions.

## Research basis

Feature scores derived from: Coimbra, M. E., Svitakova, L., Francisco, A. P., & Veiga, L. (2025). *Survey: Graph Databases*. arXiv:2505.24758.

## Preferred citation

GDB-Engines — Graph Database Comparison. https://gdb-engines.com
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
