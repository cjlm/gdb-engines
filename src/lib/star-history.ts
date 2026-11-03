/**
 * GitHub star counts over time, for the chart on each database page.
 *
 * GitHub no longer lists who starred a repository or when, so the history is put together from
 * the rankings repo (cjlm/gdb-engines-rankings, or ../gdb-engines-rankings locally):
 *
 * - history/star-history.json: totals from before the monthly snapshots began, read from
 *   Internet Archive captures of the repository page, plus monthly estimates for 2023-24 from
 *   GH Archive star events.
 * - history/metrics-*.json: the monthly metrics snapshots, from May 2026.
 * - today's live count.
 *
 * Like the star counts themselves, the history is decoration: if it can't be loaded the site
 * builds without charts, and without star-history.json the chart uses the snapshots alone.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export type StarSource = 'wayback' | 'gharchive' | 'snapshot' | 'live';

export interface StarPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  stars: number;
  source: StarSource;
}

export interface StarSnapshot {
  date: string;
  /** Catalogue slug -> stargazer count on that date. */
  stars: Record<string, number>;
}

export interface Backfill {
  /** owner/name the history was collected from, lower case. */
  repo: string;
  points: StarPoint[];
}

export interface StarHistory {
  snapshots: StarSnapshot[];
  /** Catalogue slug -> backfilled history. */
  backfill: Record<string, Backfill>;
}

interface MetricsFile {
  engines?: { slug?: string; github?: { stars?: unknown } | null }[];
}

interface BackfillFile {
  engines?: Record<string, { repo?: unknown; points?: unknown }>;
}

const REPO = process.env.RANKINGS_REPO ?? 'cjlm/gdb-engines-rankings';
const REF = process.env.RANKINGS_REF ?? 'main';
const HISTORY_DIRECTORY = 'history';
const BACKFILL_FILE = 'star-history.json';
const LOCAL_FALLBACK = resolve(process.cwd(), '..', 'gdb-engines-rankings', HISTORY_DIRECTORY);
const METRICS_FILE = /^metrics-(\d{4}-\d{2}-\d{2})\.json$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BACKFILL_SOURCES = new Set<StarSource>(['wayback', 'gharchive']);
/** A chart needs this many points, spread over at least this many days. */
const MIN_POINTS = 4;
const MIN_SPAN_DAYS = 90;
const DAY_MS = 86_400_000;

/** Slug -> stars from one metrics snapshot; engines without a numeric count are left out. */
export function parseMetrics(date: string, raw: unknown): StarSnapshot {
  const stars: Record<string, number> = {};
  for (const engine of (raw as MetricsFile)?.engines ?? []) {
    const count = engine.github?.stars;
    if (typeof engine.slug === 'string' && typeof count === 'number') stars[engine.slug] = count;
  }
  return { date, stars };
}

function isBackfillPoint(value: unknown): value is StarPoint {
  const point = value as Partial<StarPoint> | null;
  return (
    typeof point?.date === 'string' &&
    ISO_DATE.test(point.date) &&
    typeof point.stars === 'number' &&
    Number.isFinite(point.stars) &&
    BACKFILL_SOURCES.has(point.source as StarSource)
  );
}

/** Slug -> backfilled history from star-history.json; malformed entries and points are dropped. */
export function parseBackfill(raw: unknown): Record<string, Backfill> {
  const backfill: Record<string, Backfill> = {};
  for (const [slug, entry] of Object.entries((raw as BackfillFile)?.engines ?? {})) {
    if (typeof entry?.repo !== 'string' || !Array.isArray(entry.points)) continue;
    const points = entry.points
      .filter(isBackfillPoint)
      .map(({ date, stars, source }) => ({ date, stars, source }));
    if (points.length > 0) backfill[slug] = { repo: entry.repo.toLowerCase(), points };
  }
  return backfill;
}

/** owner/name in lower case for a github.com repository URL, or null. */
export function repoKey(githubUrl: string | undefined): string | null {
  const match = githubUrl?.match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)/i);
  if (!match) return null;
  return `${match[1]}/${match[2]!.replace(/\.git$/i, '')}`.toLowerCase();
}

/**
 * One engine's stars over time, oldest first: backfilled totals from before the first snapshot,
 * then each snapshot, then `current` today. Backfill collected from a different repository
 * than the catalogue links to is left out, since today's count would not continue it.
 * Empty when there are too few points, or too short a span, to show a trend.
 */
export function starSeries(
  history: StarHistory,
  engine: { slug: string; githubUrl?: string | undefined },
  current: number | null,
  today: string
): StarPoint[] {
  const snapshots: StarPoint[] = history.snapshots
    .filter((snapshot) => typeof snapshot.stars[engine.slug] === 'number' && snapshot.date < today)
    .map((snapshot) => ({
      date: snapshot.date,
      stars: snapshot.stars[engine.slug]!,
      source: 'snapshot' as const,
    }));
  const firstSnapshot = snapshots.reduce(
    (first, point) => (point.date < first ? point.date : first),
    today
  );
  const backfill = history.backfill[engine.slug];
  const earlier =
    backfill && backfill.repo === repoKey(engine.githubUrl)
      ? backfill.points.filter((point) => point.date < firstSnapshot)
      : [];
  const points = [...earlier, ...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (typeof current === 'number') points.push({ date: today, stars: current, source: 'live' });
  if (points.length < MIN_POINTS) return [];
  const span = Date.parse(points.at(-1)!.date) - Date.parse(points[0]!.date);
  return span >= MIN_SPAN_DAYS * DAY_MS ? points : [];
}

async function fetchContents(path: string, token: string, accept: string): Promise<Response> {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${REF}`;
  return fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept, 'user-agent': 'gdb-engines-build' },
  });
}

async function fetchJson(path: string, token: string, accept: string): Promise<unknown> {
  const response = await fetchContents(path, token, accept);
  if (!response.ok) {
    throw new Error(`GitHub fetch of ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** The backfill file, or null if the rankings repo doesn't have one. */
async function fetchBackfill(token: string): Promise<unknown> {
  const path = `${HISTORY_DIRECTORY}/${BACKFILL_FILE}`;
  const response = await fetchContents(path, token, 'application/vnd.github.raw');
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub fetch of ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchHistory(token: string): Promise<StarHistory> {
  const listing = (await fetchJson(HISTORY_DIRECTORY, token, 'application/vnd.github+json')) as {
    name: string;
  }[];
  const files = listing.map((entry) => entry.name).filter((name) => METRICS_FILE.test(name));
  const [snapshots, backfill] = await Promise.all([
    Promise.all(
      files.map(async (name) => {
        const path = `${HISTORY_DIRECTORY}/${name}`;
        const raw = await fetchJson(path, token, 'application/vnd.github.raw');
        return parseMetrics(METRICS_FILE.exec(name)![1]!, raw);
      })
    ),
    fetchBackfill(token),
  ]);
  return { snapshots, backfill: parseBackfill(backfill) };
}

function readLocalHistory(): StarHistory {
  if (!existsSync(LOCAL_FALLBACK)) return { snapshots: [], backfill: {} };
  const read = (name: string) => JSON.parse(readFileSync(resolve(LOCAL_FALLBACK, name), 'utf8'));
  const snapshots = readdirSync(LOCAL_FALLBACK)
    .filter((name) => METRICS_FILE.test(name))
    .map((name) => parseMetrics(METRICS_FILE.exec(name)![1]!, read(name)));
  const hasBackfill = existsSync(resolve(LOCAL_FALLBACK, BACKFILL_FILE));
  return { snapshots, backfill: hasBackfill ? parseBackfill(read(BACKFILL_FILE)) : {} };
}

let cached: Promise<StarHistory> | undefined;

/** Every star snapshot and backfilled history the rankings repo has published. */
export function loadStarHistory(): Promise<StarHistory> {
  cached ??= (async () => {
    const token = process.env.RANKINGS_TOKEN;
    try {
      return token ? await fetchHistory(token) : readLocalHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[star-history] Star history unavailable; continuing without it. ${message}`);
      return { snapshots: [], backfill: {} };
    }
  })();
  return cached;
}
