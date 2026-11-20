/**
 * Geometry for the AI co-authorship charts (blog post "Graph databases are starting to be
 * written by agents").
 *
 * Like the GitHub stars chart, lines and gridlines are drawn in a fixed viewBox the page
 * stretches to its width, and anything with text or a logo is positioned in percentages by
 * HTML, so it keeps its normal size at any width. Which labels fit depends on the rendered width,
 * so `placeLabels` runs in the browser, in pixels.
 */
import { area, curveMonotoneX, line } from 'd3-shape';

export interface RepoRow {
  slug: string;
  /** GitHub owner/name. */
  repo: string;
  vendor: string;
  /** Non-merge, non-bot commits on the default branch in the window. */
  commits: number;
  aiCommits: number;
  aiPct: number;
  aiTools: string;
  /** Year of the repository's first commit (a fork's first own commit). */
  firstYear: number;
}

export interface MonthRow {
  /** YYYY-MM. */
  month: string;
  commits: number;
  aiCommits: number;
  aiPct: number;
}

/** data/ai-coauthorship.json in the blog repo. */
export interface AiCoauthorshipData {
  window: { from: string; to: string };
  monthly: MonthRow[];
  repos: RepoRow[];
}

/** The scatter shows repositories with at least this many commits in the window. */
export const SCATTER_MIN_COMMITS = 100;
export const SCATTER_X_DOMAIN = [100, 10_000] as const;
export const SCATTER_X_TICKS = [100, 300, 1_000, 3_000, 10_000];
export const SCATTER_Y_TICKS = [0, 25, 50, 75, 100];

const round = (value: number) => Math.round(value * 100) / 100;

/** Commits as a distance from the left of the plot, in percent, on a log scale. */
export function scatterX(commits: number): number {
  const [min, max] = SCATTER_X_DOMAIN;
  const clamped = Math.min(max, Math.max(min, commits));
  return round(((Math.log10(clamped) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * 100);
}

/** A 0-100 share as a distance from the top of the plot, in percent. */
export function scatterY(pct: number): number {
  return round(100 - Math.min(100, Math.max(0, pct)));
}

export const AGE_X_TICKS = [0, 1, 5, 10, 25, 50, 100];
export const AGE_Y_DOMAIN = [2005, 2027] as const;
export const AGE_Y_TICKS = [2005, 2010, 2015, 2020, 2025];
/** Dot size range in the age view, as a share of the largest dot. */
export const AGE_MIN_SCALE = 6 / 16;

/** A 0-100 share as a distance from the left of the plot, in percent, on a square-root scale. */
export function ageX(pct: number): number {
  return round(Math.sqrt(Math.min(100, Math.max(0, pct)) / 100) * 100);
}

/** A first-commit year as a distance from the top of the plot, in percent (newest at top). */
export function ageY(year: number): number {
  const [min, max] = AGE_Y_DOMAIN;
  const clamped = Math.min(max, Math.max(min, year + 0.5));
  return round(((max - clamped) / (max - min)) * 100);
}

/**
 * A dot's size relative to the largest, by commits on a square-root scale.
 *
 * Args:
 *   commits: the repository's commits in the window.
 *   maxCommits: the largest repository's commits; it gets scale 1.
 */
export function ageScale(commits: number, maxCommits: number): number {
  const min = Math.sqrt(SCATTER_MIN_COMMITS);
  const span = Math.sqrt(maxCommits) - min;
  const share = span > 0 ? (Math.sqrt(Math.max(commits, SCATTER_MIN_COMMITS)) - min) / span : 1;
  return round(AGE_MIN_SCALE + (1 - AGE_MIN_SCALE) * Math.min(1, share));
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type LabelSide = 'right' | 'left' | 'above' | 'below';

export interface LabelPlacement {
  side: LabelSide;
  /** Extra distance from the mark, in pixels; a lifted label needs a leader line. */
  lift: number;
}

/** Beside the mark first, then a short way above or below it, on a leader. */
const LIFT_STEP = 7;
const LIFT_STEPS = 4;
const NEAR: LabelPlacement[] = (['right', 'left', 'above', 'below'] as const).map((side) => ({
  side,
  lift: 0,
}));
const LIFTED: LabelPlacement[] = Array.from({ length: LIFT_STEPS }, (_, step) =>
  (['above', 'below'] as const).map((side) => ({ side, lift: (step + 1) * LIFT_STEP })),
).flat();
const LABEL_CANDIDATES = [...NEAR, ...LIFTED];

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function labelRect(mark: Point, half: number, label: Size, placement: LabelPlacement): Rect {
  const pad = 3;
  const { side, lift } = placement;
  if (side === 'right' || side === 'left') {
    const left = side === 'right' ? mark.x + half + pad : mark.x - half - pad - label.width;
    const top = mark.y - label.height / 2;
    return { left, right: left + label.width, top, bottom: top + label.height };
  }
  const top = side === 'below' ? mark.y + half + 1 + lift : mark.y - half - 1 - lift - label.height;
  const left = mark.x - label.width / 2;
  return { left, right: left + label.width, top, bottom: top + label.height };
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Place each wanted label so it covers no mark, no other label and no edge.
 *
 * A label goes beside its mark when there is room, otherwise a short way above or below it
 * (the caller draws a leader for a lifted label).
 *
 * Args:
 *   marks: every mark's centre (labels must clear all of them).
 *   size: mark width and height, in pixels, shared or per mark.
 *   labels: per mark, the label's size, or null for a mark that should not be labelled.
 *   order: indexes into `marks`, in label priority order; earlier ones win contested space.
 *   area: the rectangle labels must stay inside.
 *
 * Returns:
 *   Per mark, the chosen placement, or null when unlabelled or nowhere was free.
 */
export function placeLabels(
  marks: Point[],
  size: number | number[],
  labels: (Size | null)[],
  order: number[],
  area: Rect,
): (LabelPlacement | null)[] {
  const halfOf = (index: number) => (typeof size === 'number' ? size : (size[index] ?? 0)) / 2;
  const taken: Rect[] = marks.map((mark, index) => ({
    left: mark.x - halfOf(index),
    right: mark.x + halfOf(index),
    top: mark.y - halfOf(index),
    bottom: mark.y + halfOf(index),
  }));
  const placements: (LabelPlacement | null)[] = marks.map(() => null);
  for (const index of order) {
    const label = labels[index];
    const mark = marks[index];
    if (!label || !mark) continue;
    const half = halfOf(index);
    const ownMark = taken[index];
    for (const candidate of LABEL_CANDIDATES) {
      const rect = labelRect(mark, half, label, candidate);
      const fits =
        rect.left >= area.left &&
        rect.right <= area.right &&
        rect.top >= area.top &&
        rect.bottom <= area.bottom;
      if (fits && taken.every((other) => other === ownMark || !overlaps(rect, other))) {
        placements[index] = candidate;
        taken.push(rect);
        break;
      }
    }
  }
  return placements;
}

/** The viewBox the monthly line is drawn in. */
export const MONTHLY_WIDTH = 600;
export const MONTHLY_HEIGHT = 200;
export const MONTHLY_Y_MAX = 25;
export const MONTHLY_Y_TICKS = [0, 5, 10, 15, 20, 25];

export interface MonthlyChart {
  line: string;
  area: string;
  /** Each month's point, in percent from the left and top. */
  points: Point[];
}

/** Line, area and point positions for the monthly share, spread evenly across the width. */
export function monthlyChart(rows: MonthRow[]): MonthlyChart {
  const toX = (index: number) => (rows.length > 1 ? (index / (rows.length - 1)) * MONTHLY_WIDTH : 0);
  const toY = (pct: number) => MONTHLY_HEIGHT - (Math.min(pct, MONTHLY_Y_MAX) / MONTHLY_Y_MAX) * MONTHLY_HEIGHT;
  const coords = rows.map((row, index): [number, number] => [toX(index), toY(row.aiPct)]);
  const curve = line().curve(curveMonotoneX);
  const fill = area().curve(curveMonotoneX).y0(MONTHLY_HEIGHT);
  return {
    line: curve(coords) ?? '',
    area: fill(coords) ?? '',
    points: coords.map(([x, y]) => ({
      x: round((x / MONTHLY_WIDTH) * 100),
      y: round((y / MONTHLY_HEIGHT) * 100),
    })),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 2025" for 2025-11. */
export function monthLabel(month: string): string {
  const [year, number] = month.split('-');
  return `${MONTHS[Number(number) - 1] ?? month} ${year}`;
}

/** Totals over a set of rows: commits, AI commits and the share to one decimal place. */
export function totals(rows: { commits: number; aiCommits: number }[]): {
  commits: number;
  aiCommits: number;
  aiPct: number;
} {
  const commits = rows.reduce((sum, row) => sum + row.commits, 0);
  const aiCommits = rows.reduce((sum, row) => sum + row.aiCommits, 0);
  return { commits, aiCommits, aiPct: commits ? Math.round((aiCommits / commits) * 1000) / 10 : 0 };
}
