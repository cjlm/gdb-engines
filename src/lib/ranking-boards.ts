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
  blurb: string;
  metaDescription: string;
  engines: RankedEngine[];
  /** For breadcrumbs/grouping on the index page. */
  group: 'overall' | 'type' | 'kind' | 'license' | 'query-language' | 'language' | 'movers';
}

const slugify = (s: string): string =>
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

export function buildBoards(ranking: RankingFile): Board[] {
  const boards: Board[] = [];

  boards.push({
    slug: 'overall',
    title: 'Graph Database Popularity Ranking',
    h1: 'Graph Database Popularity Ranking',
    blurb: blurbOverall,
    metaDescription: blurbOverall,
    engines: ranking.overall,
    group: 'overall',
  });

  for (const [type, engines] of Object.entries(ranking.byType)) {
    const label = TYPE_LABEL[type] ?? type;
    boards.push({
      slug: slugify(label),
      title: `${label} Graph Database Popularity Ranking`,
      h1: `${label} Graph Database Popularity Ranking`,
      blurb: blurbFor(label),
      metaDescription: blurbFor(label),
      engines,
      group: 'type',
    });
  }

  for (const [kind, engines] of Object.entries(ranking.byKind)) {
    if (SKIP_KIND.has(kind)) continue;
    const label = KIND_LABEL[kind] ?? kind;
    boards.push({
      slug: slugify(label),
      title: `${label} Popularity Ranking`,
      h1: `${label} Popularity Ranking`,
      blurb: blurbFor(label),
      metaDescription: blurbFor(label),
      engines,
      group: 'kind',
    });
  }

  for (const [tier, engines] of Object.entries(ranking.byLicenseTier)) {
    const label = LICENSE_LABEL[tier] ?? tier;
    boards.push({
      slug: slugify(label),
      title: `${label} Graph Database Popularity Ranking`,
      h1: `${label} Graph Database Popularity Ranking`,
      blurb: blurbFor(label),
      metaDescription: blurbFor(label),
      engines,
      group: 'license',
    });
  }

  for (const [lang, engines] of Object.entries(ranking.byQueryLanguage)) {
    boards.push({
      slug: slugify(lang),
      title: `${lang} Graph Database Popularity Ranking`,
      h1: `${lang} Graph Database Popularity Ranking`,
      blurb: blurbFor(lang),
      metaDescription: blurbFor(lang),
      engines,
      group: 'query-language',
    });
  }

  for (const [lang, engines] of Object.entries(ranking.byImplementationLanguage)) {
    boards.push({
      slug: slugify(lang),
      title: `${lang} Graph Database Popularity Ranking`,
      h1: `${lang} Graph Database Popularity Ranking`,
      blurb: `The best and most popular graph databases written in ${lang}, ranked monthly across adoption, activity, community and research signals. Compare top ${lang} graph database options.`,
      metaDescription: `The best and most popular graph databases written in ${lang}, ranked monthly. Compare top ${lang} graph database options.`,
      engines,
      group: 'language',
    });
  }

  boards.push({
    slug: 'movers',
    title: 'Graph Database Movers',
    h1: 'Graph Database Movers',
    blurb: blurbMovers,
    metaDescription: blurbMovers,
    engines: ranking.movers,
    group: 'movers',
  });

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
