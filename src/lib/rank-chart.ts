/**
 * Geometry for the bump chart of overall rank by month on the graph page's Rankings view.
 *
 * Drawn at its natural pixel size so text stays legible; the page scrolls it sideways when it
 * is wider than the screen. Rank 1 is at the top. A month in which an engine is outside the
 * top N is drawn on a strip below the last row, so lines entering or leaving the top N run to
 * that edge, as a faded stub, instead of stopping dead.
 */
import { curveBumpX, line } from 'd3-shape';
import type { RankSeries } from './rank-history';

const MONTH_GAP = 112;
const LEFT = 40;
const TOP = 44;
const RIGHT = 220;
const BOTTOM = 12;
const ROW_HEIGHT: Record<number, number> = { 10: 34, 20: 25, 50: 17 };
const DEFAULT_ROW_HEIGHT = 20;
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface RankMarker {
  x: number;
  y: number;
  /** Rank as shown on hover: the number, or an en dash when the engine wasn't ranked. */
  label: string;
  inTop: boolean;
}

export interface RankLine {
  slug: string;
  name: string;
  current: number | null;
  inCurrentTop: boolean;
  /** Path through the months the engine is in the top N; empty if it never is twice running. */
  path: string;
  /** Two-point segments between a month in the top N and a neighbouring month outside it. */
  stubs: string[];
  markers: RankMarker[];
  /** Where the name goes: the right end for today's top N, else after its last month in it. */
  label: { x: number; y: number };
}

export interface RankChart {
  width: number;
  height: number;
  topN: number;
  /** y of the strip that months outside the top N are drawn on. */
  edgeY: number;
  rows: { rank: number; y: number }[];
  columns: { month: string; label: string; year: string | null; x: number }[];
  lines: RankLine[];
}

interface PlacedPoint {
  x: number;
  y: number;
  inTop: boolean;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** "May", with the year beside the first month and every January. */
export function monthLabel(month: string, index: number): { label: string; year: string | null } {
  const [year, number] = month.split('-');
  const label = MONTH_NAMES[Number(number) - 1] ?? month;
  return { label, year: index === 0 || number === '01' ? (year ?? null) : null };
}

function segment(from: [number, number], to: [number, number]): string {
  return line().curve(curveBumpX)([from, to]) ?? '';
}

export function layoutRankChart(series: RankSeries[], topN: number): RankChart {
  const months = series[0]?.points.map((point) => point.month) ?? [];
  const rowHeight = ROW_HEIGHT[topN] ?? DEFAULT_ROW_HEIGHT;
  const xOf = (index: number) => LEFT + index * MONTH_GAP;
  const yOfRank = (rank: number) => round(TOP + (rank - 0.5) * rowHeight);
  const edgeY = round(TOP + topN * rowHeight + rowHeight * 0.75);
  const inTop = (rank: number | null) => rank !== null && rank <= topN;
  const draw = line()
    .defined((point: PlacedPoint) => point.inTop)
    .x((point: PlacedPoint) => point.x)
    .y((point: PlacedPoint) => point.y)
    .curve(curveBumpX);

  const lines = series.map((entry): RankLine => {
    const placed = entry.points.map((point, index) => ({
      x: xOf(index),
      y: inTop(point.rank) ? yOfRank(point.rank!) : edgeY,
      inTop: inTop(point.rank),
      label: point.rank === null ? '–' : String(point.rank),
    }));
    const stubs: string[] = [];
    for (let index = 1; index < placed.length; index++) {
      const before = placed[index - 1]!;
      const after = placed[index]!;
      if (before.inTop !== after.inTop) {
        stubs.push(segment([before.x, before.y], [after.x, after.y]));
      }
    }
    const markers = placed.filter(
      (point, index) => point.inTop || placed[index - 1]?.inTop || placed[index + 1]?.inTop
    );
    const lastInTop = placed.findLast((point) => point.inTop) ?? placed.at(-1)!;
    return {
      slug: entry.slug,
      name: entry.name,
      current: entry.current,
      inCurrentTop: entry.inCurrentTop,
      path: draw(placed) ?? '',
      stubs,
      markers: markers.map(({ x, y, label, inTop: top }) => ({ x, y, label, inTop: top })),
      label: { x: lastInTop.x + 14, y: lastInTop.y },
    };
  });

  return {
    width: xOf(Math.max(0, months.length - 1)) + RIGHT,
    height: round(edgeY + rowHeight / 2 + BOTTOM),
    topN,
    edgeY,
    rows: Array.from({ length: topN }, (_, index) => ({ rank: index + 1, y: yOfRank(index + 1) })),
    columns: months.map((month, index) => ({ month, ...monthLabel(month, index), x: xOf(index) })),
    lines,
  };
}
