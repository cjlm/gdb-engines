/**
 * Data shaping for the charts in the blog post "How Neo4j built a graph database in ten weeks".
 * The data is synced from the blog repo's data/ folder (see src/lib/blog-data.ts).
 *
 * Positions are percentages of the plot box so the charts stretch to any width, as in
 * src/lib/ai-coauthorship-chart.ts.
 */

/** One talk from data/eifrem-talks.json: mentions of each term, or null where not counted. */
export interface Talk {
  id: string;
  /** Upload date, YYYY-MM-DD. */
  d: string;
  t: string;
  /** Kind of video: keynote, podcast, panel... */
  k: string;
  solo: boolean;
  /** Caption words. */
  w: number;
  ont: number | null;
  sem: number | null;
  kg: number | null;
  rag: number | null;
  ctx: number | null;
  dev: number | null;
  ent: number | null;
  stu: number | null;
}

export type TermKey = 'ont' | 'sem' | 'kg' | 'rag' | 'ctx' | 'dev' | 'ent' | 'stu';

export interface TermSeries {
  key: TermKey;
  name: string;
}

export interface TermNote {
  key: TermKey;
  period: string;
  text: string;
}

export interface TermChartConfig {
  series: TermSeries[];
  notes: TermNote[];
}

export const ONTOLOGY_CHART: TermChartConfig = {
  series: [
    { key: 'ont', name: 'Ontology' },
    { key: 'sem', name: 'Semantics & RDF' },
    { key: 'kg', name: 'Knowledge graph' },
    { key: 'rag', name: 'GraphRAG' },
    { key: 'ctx', name: 'Context graph' },
  ],
  notes: [
    { key: 'ont', period: '2024 H2', text: 'Nov 2024: “intellectual snobism… I hate that”' },
    { key: 'ont', period: '2026 H1', text: 'Mar 2026: “a huge fan”' },
  ],
};

export const AUDIENCE_CHART: TermChartConfig = {
  series: [
    { key: 'dev', name: 'Developers' },
    { key: 'ent', name: 'Enterprise (incl. Global 2000, Fortune)' },
    { key: 'stu', name: 'Startups' },
  ],
  notes: [],
};

export const FIRST_YEAR = 2017;
export const LAST_YEAR = 2026;

/** Half-year periods from FIRST_YEAR to LAST_YEAR, as "2017 H1". */
export const PERIODS: string[] = Array.from({ length: (LAST_YEAR - FIRST_YEAR + 1) * 2 }, (_, i) => {
  const year = FIRST_YEAR + Math.floor(i / 2);
  return `${year} H${(i % 2) + 1}`;
});

/** The half-year a YYYY-MM-DD date falls in. */
export function periodOf(date: string): string {
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 4)} H${month <= 6 ? 1 : 2}`;
}

export interface PooledPeriod {
  period: string;
  talks: Talk[];
  words: number;
  /** Mentions per 1,000 caption words, pooled across the period's talks; null with no talks. */
  rates: Partial<Record<TermKey, number | null>>;
}

/**
 * Pool talks into half-years: each rate is all mentions over all words in the period, so a
 * short clip counts in proportion to its length. Talks missing a count for any of the series
 * are left out of every series, so the rows of one chart always share their talks.
 */
export function poolByHalfYear(talks: Talk[], series: TermSeries[]): PooledPeriod[] {
  return PERIODS.map((period) => {
    const inPeriod = talks.filter(
      (talk) => periodOf(talk.d) === period && series.every(({ key }) => talk[key] !== null),
    );
    const words = inPeriod.reduce((sum, talk) => sum + talk.w, 0);
    const rates: PooledPeriod['rates'] = {};
    for (const { key } of series) {
      const mentions = inPeriod.reduce((sum, talk) => sum + (talk[key] ?? 0), 0);
      rates[key] = words > 0 ? Math.round((mentions / words) * 10_000) / 10 : null;
    }
    return { period, talks: inPeriod, words, rates };
  });
}

/** The largest pooled rate across all series, so every row shares one scale. */
export function maxRate(pooled: PooledPeriod[], series: TermSeries[]): number {
  let max = 0;
  for (const period of pooled) {
    for (const { key } of series) max = Math.max(max, period.rates[key] ?? 0);
  }
  return max;
}

/** How a commit's AI help was recorded, from data/relate-first-days.json. */
export type CommitAi = 'main' | 'branch' | 'none' | 'bot' | 'unknown' | 'pre';

export interface FirstDaysCommit {
  /** Days since the project's first public commit. */
  day: number;
  lines: number;
  files: number;
  ai: CommitAi;
  /** Local time, "YYYY-MM-DD HH:MM". */
  time: string;
  author: string;
}

export interface FirstDaysProject {
  name: string;
  start: string;
  history: string;
  commits: FirstDaysCommit[];
}

export interface FirstDaysData {
  neo4j: FirstDaysProject;
  relate: FirstDaysProject;
}

export const FIRST_DAYS = 11;

/** A day offset as a distance from the left of the plot, in percent. */
export function dayX(day: number): number {
  return Math.round((Math.min(FIRST_DAYS, Math.max(0, day)) / FIRST_DAYS) * 10_000) / 100;
}

/** Dot diameter in pixels, with area roughly proportional to lines added: 10, 100 and 1,000 lines give about 5, 8 and 15px. */
export function dotDiameter(lines: number): number {
  return Math.round(Math.min(22, 4 + 0.35 * Math.sqrt(Math.max(0, lines))) * 10) / 10;
}

/** A spread of vertical offsets, in percent of the row, so dots at the same time stay apart. */
export function dotY(index: number): number {
  return 50 + (((index * 37) % 9) - 4) * 10;
}

export interface AiCounts {
  commits: number;
  /** AI trailer on the squashed commit, or only on its pull-request branch. */
  ai: number;
  aiPct: number;
}

/** AI-assisted commits out of all commits, counting bots and unknowns in the total. */
export function aiCounts(commits: FirstDaysCommit[]): AiCounts {
  const ai = commits.filter((commit) => commit.ai === 'main' || commit.ai === 'branch').length;
  return { commits: commits.length, ai, aiPct: commits.length ? Math.round((ai / commits.length) * 100) : 0 };
}

/** One day from data/relate-adrs.json: decision records first added on that day. */
export interface AdrDay {
  date: string;
  added: number;
}

export interface AdrData {
  repository: string;
  throughDate: string;
  days: AdrDay[];
}

export interface AdrBar extends AdrDay {
  /** Running total of records after this day. */
  total: number;
  /** Bar height as a share of the tallest bar, in percent. */
  height: number;
}

/** Daily bars with a running total, all on one linear scale. */
export function adrBars(days: AdrDay[]): AdrBar[] {
  const tallest = Math.max(1, ...days.map((day) => day.added));
  let total = 0;
  return days.map((day) => {
    total += day.added;
    return { ...day, total, height: Math.round((day.added / tallest) * 10_000) / 100 };
  });
}
