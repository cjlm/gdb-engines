/**
 * Charts a Markdown blog post can place between its paragraphs.
 *
 * A post places a chart with an empty figure on its own line, separated by blank lines:
 *
 *   <figure data-chart="some-chart-id"></figure>
 *
 * Each id names a spec, charts/<id>.json in the private blog repo, synced into
 * src/data/blog-charts/ by scripts/sync-blog.mjs. A spec carries everything the chart shows:
 * the chart's ECharts option (values, labels, tooltips), its caption, notes and data table, or a
 * page of this site to embed. This repo only has the generic renderers that draw a spec as given
 * (src/components/blog/), so no post's data or reasoning lives here. A marker without a valid
 * spec fails the build.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

/** A legend entry drawn above the chart: a swatch in a theme colour and its label. */
export interface LegendItem {
  label: string;
  /** Theme colour name, as in "token:<name>", or a fixed "#rrggbb" for colours the chart itself
   * picks (Garphield's categorical palette, say). */
  color: string;
  opacity?: number;
  /** Outline the swatch in the ink colour. */
  ring?: boolean;
  /** Draw several dots of these diameters in pixels, for a size key. */
  sizes?: number[];
}

interface BaseSpec {
  version: 1;
  /** Screen-reader summary of the whole chart. */
  ariaLabel: string;
  caption: string;
  /** Numbered notes shown under the plot; markers in the plot refer to them by number. */
  notes?: string[];
  legend?: LegendItem[];
  table?: TableSpec;
}

/**
 * An ECharts option, drawn in the page's colours. It is plain JSON, so a few placeholders stand in
 * for what JSON cannot hold; the renderer (src/lib/echarts-mount.ts) resolves them:
 * - "token:<name>" or "token:<name>/<alpha>": a theme colour (accent, ink, ink2, ink3, rule,
 *   bg, grid, c1, c2; see BlogChart.astro), re-read when the theme changes;
 * - "font:<heading|body|mono>": the site's font stacks;
 * - {"__map": {...}, "__default": ""}: a formatter that looks the value up;
 * - {"__number": true}: a formatter that groups digits ("12,345");
 * - {"__gradient": [[offset, colour], ...]}: a top-to-bottom gradient.
 * With `tooltip.useTip`, a data item's `tip` (HTML written by the blog repo) is its tooltip.
 */
export interface EChartsSpec extends BaseSpec {
  type: 'echarts';
  option: Record<string, unknown>;
  /** Height in pixels on wide screens, and on screens up to 560px wide. */
  height: number;
  mobileHeight?: number;
  /** Width the dot sizes were laid out at; narrower charts scale `symbolSize` down to match. */
  scaleToWidth?: number;
}

/** A page of this site shown in a frame, such as the graph timeline. */
export interface EmbedSpec extends BaseSpec {
  type: 'embed';
  /** Site-relative path, starting with "/". */
  src: string;
  height: number;
  mobileHeight?: number;
  link?: { href: string; label: string };
}

/**
 * A network drawn by the hosted Garphield embed (garphield.com), from a Garphield document
 * (`{info, datasets: [{id, graph: {nodes, links}}], config}`) carried in the spec.
 */
export interface GarphieldSpec extends BaseSpec {
  type: 'garphield';
  document: { datasets: { graph: { nodes: unknown[]; links: unknown[] } }[] } & Record<string, unknown>;
  height: number;
  mobileHeight?: number;
}

export type ChartSpec = EChartsSpec | EmbedSpec | GarphieldSpec;

const CHART_TYPES = ['echarts', 'embed', 'garphield'] as const;
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
  if (spec.type === 'embed' && !(typeof spec.src === 'string' && spec.src.startsWith('/') && !spec.src.startsWith('//'))) {
    throw new Error(`[blog] ${where} embeds "${String(spec.src)}"; only pages of this site ("/...") can be embedded.`);
  }
  for (const item of spec.legend ?? []) {
    if (!/^([a-z0-9]+|#[0-9a-f]{6})$/i.test(item.color)) {
      throw new Error(`[blog] ${where} has a legend colour "${item.color}"; use a theme colour name or #rrggbb.`);
    }
  }
  if (spec.type === 'garphield' && !Array.isArray(spec.document?.datasets?.[0]?.graph?.nodes)) {
    throw new Error(`[blog] ${where} has no Garphield graph to draw.`);
  }
  if (spec.type === 'echarts' && (typeof spec.option !== 'object' || spec.option === null)) {
    throw new Error(`[blog] ${where} has no ECharts option.`);
  }
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
