/**
 * Charts a Markdown blog post can place between its paragraphs.
 *
 * A post places a chart with an empty figure on its own line, separated by blank lines:
 *
 *   <figure data-chart="some-chart-id"></figure>
 *
 * Each id names a spec, charts/<id>.json in the private blog repo, synced into
 * src/data/blog-charts/ by scripts/sync-blog.mjs. A spec carries everything the chart shows:
 * values, labels, tooltips, caption, notes and data table. This repo only has the generic
 * renderers that draw a spec as given (src/components/blog/), so no post's data or reasoning
 * lives here. A marker without a valid spec fails the build.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { area, curveMonotoneX, line } from 'd3-shape';

export type PostPart = { type: 'html'; html: string } | { type: 'chart'; id: string };

const CHART_MARKER = /<figure\s+data-chart="([^"]*)"\s*>\s*<\/figure>/g;
const CHART_ID = /^[a-z0-9][a-z0-9-]*$/;

/** Whether a post's rendered HTML places any chart. */
export function hasBlogCharts(html: string): boolean {
  return new RegExp(CHART_MARKER.source).test(html);
}

/**
 * Split rendered post HTML into HTML runs and chart placements, in document order.
 *
 * Raises:
 *   Error: a marker's id is not a lowercase slug.
 */
export function splitPostHtml(html: string, postId = 'post'): PostPart[] {
  const parts: PostPart[] = [];
  let cursor = 0;
  for (const match of html.matchAll(CHART_MARKER)) {
    const id = match[1] ?? '';
    if (!CHART_ID.test(id)) {
      throw new Error(`Blog post "${postId}" places a chart with an invalid id "${id}"; use a lowercase slug.`);
    }
    const before = html.slice(cursor, match.index);
    if (before.trim()) parts.push({ type: 'html', html: before });
    parts.push({ type: 'chart', id });
    cursor = match.index + match[0].length;
  }
  const rest = html.slice(cursor);
  if (rest.trim()) parts.push({ type: 'html', html: rest });
  return parts;
}

export interface TableSpec {
  columns: { label: string; numeric?: boolean }[];
  rows: string[][];
}

interface BaseSpec {
  version: 1;
  /** Screen-reader summary of the whole chart. */
  ariaLabel: string;
  caption: string;
  /** Numbered notes shown under the plot; markers in the plot refer to them by number. */
  notes?: string[];
  table?: TableSpec;
}

export interface LineSpec extends BaseSpec {
  type: 'line';
  yMax: number;
  yTicks: number[];
  yUnit?: string;
  /** Evenly spaced points, left to right. */
  points: { value: number; tooltip: string; hollow?: boolean }[];
  xLabels: { index: number; label: string; sub?: string }[];
  /** Label beside the last point. */
  endLabel?: string;
}

export interface BarsSpec extends BaseSpec {
  type: 'bars';
  bars: { value: number; valueLabel?: string; tooltip: string }[];
  xLabels: { index: number; label: string }[];
}

export interface SmallMultiplesSpec extends BaseSpec {
  type: 'small-multiples';
  /** Slots per row; bars sit at an index, and missing indexes are left blank. */
  columns: number;
  /** One scale for every row. */
  max: number;
  rows: { name: string; bars: { index: number; value: number; tooltip: string; marker?: string }[] }[];
  xLabels: { index: number; label: string }[];
}

export type DotStyle = 'solid' | 'ring' | 'faint' | 'muted';

export interface DotStripSpec extends BaseSpec {
  type: 'dot-strip';
  xMax: number;
  xLabels: { value: number; label: string }[];
  legend: { style: DotStyle; label: string }[];
  rows: {
    title: string;
    lines?: string[];
    /** x on the 0..xMax axis; y in percent of the row; size in pixels. */
    dots: { x: number; y: number; size: number; style: DotStyle; tooltip: string }[];
  }[];
}

export type ChartSpec = LineSpec | BarsSpec | SmallMultiplesSpec | DotStripSpec;

const CHART_TYPES = ['line', 'bars', 'small-multiples', 'dot-strip'] as const;
const SPEC_DIR = resolve(process.cwd(), 'src', 'data', 'blog-charts');

/**
 * Parse and check a chart spec.
 *
 * Raises:
 *   Error: the spec has an unknown version or type, or is missing its caption or aria label.
 */
export function parseChartSpec(raw: unknown, id: string): ChartSpec {
  const spec = raw as Partial<ChartSpec> | null;
  const where = `chart spec "${id}"`;
  if (!spec || typeof spec !== 'object') throw new Error(`[blog] ${where} is not a JSON object.`);
  if (spec.version !== 1) throw new Error(`[blog] ${where} has version ${String(spec.version)}; this site reads version 1.`);
  if (!CHART_TYPES.includes(spec.type as (typeof CHART_TYPES)[number])) {
    throw new Error(`[blog] ${where} has unknown type "${String(spec.type)}"; known types: ${CHART_TYPES.join(', ')}.`);
  }
  if (!spec.ariaLabel || !spec.caption) throw new Error(`[blog] ${where} needs an ariaLabel and a caption.`);
  return spec as ChartSpec;
}

/**
 * Read the synced spec for a chart id.
 *
 * Raises:
 *   Error: no spec was synced for the id, or the spec is invalid.
 */
export function loadChartSpec(id: string): ChartSpec {
  const file = resolve(SPEC_DIR, `${id}.json`);
  if (!existsSync(file)) {
    throw new Error(
      `[blog] a post places chart "${id}", but src/data/blog-charts/${id}.json was not synced. ` +
        'Add charts/' + id + '.json to the blog repo and run `npm run sync-blog`.',
    );
  }
  return parseChartSpec(JSON.parse(readFileSync(file, 'utf8')), id);
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Bar height as a share of the scale, in percent. */
export function barHeight(value: number, max: number): number {
  return max > 0 ? round((Math.max(0, value) / max) * 100) : 0;
}

/** A slot's left edge and width in percent, for `count` evenly spaced slots with a gap. */
export function slot(index: number, count: number): { left: number; width: number } {
  const step = 100 / count;
  return { left: round(index * step + step * 0.15), width: round(step * 0.7) };
}

export const LINE_WIDTH = 600;
export const LINE_HEIGHT = 200;

export interface LineGeometry {
  line: string;
  area: string;
  /** Each point in percent from the left and top of the plot. */
  points: { x: number; y: number }[];
}

/** Paths in a LINE_WIDTH x LINE_HEIGHT viewBox, and point positions in percent. */
export function lineGeometry(values: number[], yMax: number): LineGeometry {
  const xOf = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * LINE_WIDTH : 0);
  const yOf = (v: number) => LINE_HEIGHT - (Math.min(yMax, Math.max(0, v)) / yMax) * LINE_HEIGHT;
  const coords = values.map((v, i) => [xOf(i), yOf(v)] as [number, number]);
  return {
    line: line().curve(curveMonotoneX)(coords) ?? '',
    area: area().curve(curveMonotoneX).y0(LINE_HEIGHT)(coords) ?? '',
    points: coords.map(([x, y]) => ({ x: round((x / LINE_WIDTH) * 100), y: round((y / LINE_HEIGHT) * 100) })),
  };
}

/** Microtip side for a mark at x percent, so tooltips stay inside the plot. */
export function tipSide(x: number): 'top' | 'top-left' | 'top-right' {
  return x < 15 ? 'top-right' : x > 85 ? 'top-left' : 'top';
}
