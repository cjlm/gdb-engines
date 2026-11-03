/**
 * GitHub star counts over time, for the sparkline on each database page.
 *
 * GitHub no longer lists who starred a repository or when, so the history comes from the monthly
 * metrics snapshots in the rankings repo (history/metrics-*.json), plus today's live count.
 * Like the star counts themselves, the history is decoration: if it can't be loaded the site
 * builds without sparklines.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface StarPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  stars: number;
}

export interface StarSnapshot {
  date: string;
  /** Catalogue slug -> stargazer count on that date. */
  stars: Record<string, number>;
}

interface MetricsFile {
  engines?: { slug?: string; github?: { stars?: unknown } | null }[];
}

const REPO = process.env.RANKINGS_REPO ?? 'cjlm/gdb-engines-rankings';
const REF = process.env.RANKINGS_REF ?? 'main';
const HISTORY_DIRECTORY = 'history';
const LOCAL_FALLBACK = resolve(process.cwd(), '..', 'gdb-engines-rankings', HISTORY_DIRECTORY);
const METRICS_FILE = /^metrics-(\d{4}-\d{2}-\d{2})\.json$/;
/** Fewer points than this draw a line, not a history. */
const MIN_POINTS = 3;

/** Slug -> stars from one metrics snapshot; engines without a numeric count are left out. */
export function parseMetrics(date: string, raw: unknown): StarSnapshot {
  const stars: Record<string, number> = {};
  for (const engine of (raw as MetricsFile)?.engines ?? []) {
    const count = engine.github?.stars;
    if (typeof engine.slug === 'string' && typeof count === 'number') stars[engine.slug] = count;
  }
  return { date, stars };
}

/**
 * One engine's stars at each snapshot that has them, oldest first, ending with `current` today.
 * Empty when there are too few points to show a trend.
 */
export function starSeries(
  snapshots: StarSnapshot[],
  slug: string,
  current: number | null,
  today: string
): StarPoint[] {
  const points = snapshots
    .filter((snapshot) => typeof snapshot.stars[slug] === 'number' && snapshot.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((snapshot) => ({ date: snapshot.date, stars: snapshot.stars[slug]! }));
  if (typeof current === 'number') points.push({ date: today, stars: current });
  return points.length >= MIN_POINTS ? points : [];
}

/**
 * An SVG path through `points` in a `width` x `height` box: time runs left to right, and the
 * fewest stars sit at the bottom edge. A count that never changed is drawn as a midline.
 */
export function sparklinePath(points: StarPoint[], width: number, height: number): string {
  if (points.length < 2) return '';
  const times = points.map((point) => Date.parse(point.date));
  const first = times[0]!;
  const span = times[times.length - 1]! - first || 1;
  const counts = points.map((point) => point.stars);
  const low = Math.min(...counts);
  const range = Math.max(...counts) - low;
  const round = (value: number) => Math.round(value * 10) / 10;
  return points
    .map((point, index) => {
      const x = ((times[index]! - first) / span) * width;
      const y = range === 0 ? height / 2 : height - ((point.stars - low) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
    })
    .join('');
}

async function fetchJson(path: string, token: string, accept: string): Promise<unknown> {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${REF}`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept, 'user-agent': 'gdb-engines-build' },
  });
  if (!response.ok) {
    throw new Error(`GitHub fetch of ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchSnapshots(token: string): Promise<StarSnapshot[]> {
  const listing = (await fetchJson(HISTORY_DIRECTORY, token, 'application/vnd.github+json')) as {
    name: string;
  }[];
  const files = listing.map((entry) => entry.name).filter((name) => METRICS_FILE.test(name));
  return Promise.all(
    files.map(async (name) => {
      const path = `${HISTORY_DIRECTORY}/${name}`;
      const raw = await fetchJson(path, token, 'application/vnd.github.raw');
      return parseMetrics(METRICS_FILE.exec(name)![1]!, raw);
    })
  );
}

function readLocalSnapshots(): StarSnapshot[] {
  if (!existsSync(LOCAL_FALLBACK)) return [];
  return readdirSync(LOCAL_FALLBACK)
    .filter((name) => METRICS_FILE.test(name))
    .map((name) => {
      const raw = JSON.parse(readFileSync(resolve(LOCAL_FALLBACK, name), 'utf8'));
      return parseMetrics(METRICS_FILE.exec(name)![1]!, raw);
    });
}

let cached: Promise<StarSnapshot[]> | undefined;

/** Every monthly star snapshot the rankings repo has published, in no particular order. */
export function loadStarSnapshots(): Promise<StarSnapshot[]> {
  cached ??= (async () => {
    const token = process.env.RANKINGS_TOKEN;
    try {
      return token ? await fetchSnapshots(token) : readLocalSnapshots();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[star-history] Star history unavailable; continuing without it. ${message}`);
      return [];
    }
  })();
  return cached;
}
