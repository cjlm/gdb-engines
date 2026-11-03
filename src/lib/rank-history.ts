/**
 * Overall rank by month, for the Rankings view on the graph page.
 *
 * The rankings repo (cjlm/gdb-engines-rankings, or ../gdb-engines-rankings locally) keeps each
 * run's ranking as history/ranking-YYYY-MM-DD.json. Some months have several runs; the last run
 * in each calendar month stands for that month.
 *
 * Like the star history, this is decoration: if it can't be loaded the site builds without the
 * view.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RankSnapshot {
  /** ISO date of the run (YYYY-MM-DD), from the file name. */
  date: string;
  methodologyVersion: string;
  /** Engines in rank order: index 0 is rank 1. */
  engines: { slug: string; name: string }[];
}

export interface RankPoint {
  /** YYYY-MM. */
  month: string;
  /** Overall rank that month, or null if the engine wasn't ranked. */
  rank: number | null;
}

export interface RankSeries {
  slug: string;
  name: string;
  /** One point per month, oldest first. */
  points: RankPoint[];
  /** Rank in the latest month, or null if the engine has since dropped out of the ranking. */
  current: number | null;
  /** Whether the engine is in the top N in the latest month. */
  inCurrentTop: boolean;
}

interface RankingFileShape {
  methodologyVersion?: unknown;
  overall?: { slug?: unknown; name?: unknown }[];
}

const REPO = process.env.RANKINGS_REPO ?? 'cjlm/gdb-engines-rankings';
const REF = process.env.RANKINGS_REF ?? 'main';
const HISTORY_DIRECTORY = 'history';
const LOCAL_FALLBACK = resolve(process.cwd(), '..', 'gdb-engines-rankings', HISTORY_DIRECTORY);
const RANKING_FILE = /^ranking-(\d{4}-\d{2}-\d{2})\.json$/;

/** One run's overall ranking; engines without a string slug and name are left out. */
export function parseRanking(date: string, raw: unknown): RankSnapshot {
  const file = raw as RankingFileShape | null;
  const engines: RankSnapshot['engines'] = [];
  for (const engine of file?.overall ?? []) {
    if (typeof engine?.slug === 'string' && typeof engine.name === 'string') {
      engines.push({ slug: engine.slug, name: engine.name });
    }
  }
  return { date, methodologyVersion: String(file?.methodologyVersion ?? 'unknown'), engines };
}

/** The last run in each calendar month, oldest month first. */
export function monthlySnapshots(snapshots: RankSnapshot[]): RankSnapshot[] {
  const byMonth = new Map<string, RankSnapshot>();
  for (const snapshot of snapshots) {
    const month = snapshot.date.slice(0, 7);
    const kept = byMonth.get(month);
    if (!kept || snapshot.date > kept.date) byMonth.set(month, snapshot);
  }
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** 1-based rank of `slug` in a snapshot, or null if it isn't ranked. */
export function rankOf(snapshot: RankSnapshot, slug: string): number | null {
  const index = snapshot.engines.findIndex((engine) => engine.slug === slug);
  return index === -1 ? null : index + 1;
}

/** Distinct methodology versions across the months, in order of first appearance. */
export function methodologyVersions(months: RankSnapshot[]): string[] {
  return [...new Set(months.map((month) => month.methodologyVersion))];
}

/**
 * A series for every engine that was in the top `topN` in at least one month: today's top N
 * first, in rank order, then engines that have dropped out, by their best rank.
 */
export function rankSeries(months: RankSnapshot[], topN: number): RankSeries[] {
  const latest = months.at(-1);
  if (!latest) return [];
  const names = new Map<string, string>();
  for (const month of months) {
    for (const engine of month.engines.slice(0, topN)) names.set(engine.slug, engine.name);
  }
  const series: RankSeries[] = [];
  for (const [slug, name] of names) {
    const points = months.map((month) => ({
      month: month.date.slice(0, 7),
      rank: rankOf(month, slug),
    }));
    const current = points.at(-1)!.rank;
    series.push({ slug, name, points, current, inCurrentTop: current !== null && current <= topN });
  }
  const best = (entry: RankSeries) =>
    Math.min(...entry.points.map((point) => point.rank ?? Number.POSITIVE_INFINITY));
  return series.sort((a, b) => {
    if (a.inCurrentTop !== b.inCurrentTop) return a.inCurrentTop ? -1 : 1;
    if (a.inCurrentTop) return a.current! - b.current!;
    return best(a) - best(b) || a.name.localeCompare(b.name);
  });
}

async function fetchContents(path: string, token: string, accept: string): Promise<unknown> {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${REF}`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept, 'user-agent': 'gdb-engines-build' },
  });
  if (!response.ok) {
    throw new Error(`GitHub fetch of ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** File names of the last run in each month, so only those files are downloaded. */
function lastRunPerMonth(names: string[]): string[] {
  const dated = names
    .filter((name) => RANKING_FILE.test(name))
    .map((name) => ({ date: RANKING_FILE.exec(name)![1]!, methodologyVersion: '', engines: [] }));
  return monthlySnapshots(dated).map((snapshot) => `ranking-${snapshot.date}.json`);
}

async function fetchHistory(token: string): Promise<RankSnapshot[]> {
  const listing = (await fetchContents(
    HISTORY_DIRECTORY,
    token,
    'application/vnd.github+json'
  )) as { name: string }[];
  const files = lastRunPerMonth(listing.map((entry) => entry.name));
  return Promise.all(
    files.map(async (name) => {
      const raw = await fetchContents(
        `${HISTORY_DIRECTORY}/${name}`,
        token,
        'application/vnd.github.raw'
      );
      return parseRanking(RANKING_FILE.exec(name)![1]!, raw);
    })
  );
}

function readLocalHistory(): RankSnapshot[] {
  if (!existsSync(LOCAL_FALLBACK)) return [];
  return lastRunPerMonth(readdirSync(LOCAL_FALLBACK)).map((name) => {
    const raw = JSON.parse(readFileSync(resolve(LOCAL_FALLBACK, name), 'utf8'));
    return parseRanking(RANKING_FILE.exec(name)![1]!, raw);
  });
}

let cached: Promise<RankSnapshot[]> | undefined;

/** The last ranking run of each month the rankings repo has published, oldest first. */
export function loadMonthlyRankings(): Promise<RankSnapshot[]> {
  cached ??= (async () => {
    const token = process.env.RANKINGS_TOKEN;
    try {
      return monthlySnapshots(token ? await fetchHistory(token) : readLocalHistory());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[rank-history] Rank history unavailable; continuing without it. ${message}`);
      return [];
    }
  })();
  return cached;
}
