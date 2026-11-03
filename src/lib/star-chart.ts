/**
 * Geometry for the GitHub stars chart on database pages.
 *
 * The line and area are drawn in a fixed viewBox that the page stretches to its width, while
 * labels and the end marker are positioned in percentages by HTML, so text stays its normal
 * size at any width.
 */
import { area, curveMonotoneX, line } from 'd3-shape';
import type { StarPoint } from './star-history';

/** The viewBox the paths are drawn in. */
export const CHART_WIDTH = 600;
export const CHART_HEIGHT = 120;
/** Aim for this many gridlines above the baseline. */
const TARGET_TICKS = 3;
/** Year labels closer than this to either end (as a share of the width) are dropped. */
const EDGE_CLEARANCE = 0.14;
const MAX_YEAR_LABELS = 5;

export interface Tick {
  value: number;
  /** Distance from the left or top, in percent. */
  offset: number;
}

export interface StarChart {
  line: string;
  area: string;
  /** Gridlines from the baseline up; offset is from the top. */
  yTicks: Tick[];
  /** Start of each labelled year; offset is from the left. */
  xTicks: Tick[];
  /** The last point, in percent from the left and top. */
  end: { x: number; y: number };
}

/** A round step that splits [0, max] into about TARGET_TICKS parts: 1, 2 or 5 x 10^n. */
export function niceStep(max: number): number {
  const rough = max / TARGET_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].find((multiple) => multiple * magnitude >= rough)! * magnitude;
  return Math.max(1, step);
}

const round = (value: number) => Math.round(value * 100) / 100;

function yearTicks(first: number, last: number, toX: (time: number) => number): Tick[] {
  const firstYear = new Date(first).getUTCFullYear() + 1;
  const lastYear = new Date(last).getUTCFullYear();
  const every = Math.ceil((lastYear - firstYear + 1) / MAX_YEAR_LABELS);
  const ticks: Tick[] = [];
  for (let year = firstYear; year <= lastYear; year += every) {
    const offset = (toX(Date.UTC(year, 0, 1)) / CHART_WIDTH) * 100;
    if (offset >= EDGE_CLEARANCE * 100 && offset <= (1 - EDGE_CLEARANCE) * 100) {
      ticks.push({ value: year, offset: round(offset) });
    }
  }
  return ticks;
}

/**
 * Paths and ticks for `points` (oldest first, spanning at least two dates). Stars are measured
 * from zero, so the area's height is the real total; the top gridline is the first round step
 * at or above the highest count.
 */
export function starChart(points: StarPoint[]): StarChart {
  const times = points.map((point) => Date.parse(point.date));
  const first = times[0]!;
  const last = times.at(-1)!;
  const span = last - first;
  const highest = Math.max(...points.map((point) => point.stars));
  const step = niceStep(highest);
  const top = Math.max(step, Math.ceil(highest / step) * step);

  const toX = (time: number) => ((time - first) / span) * CHART_WIDTH;
  const toY = (stars: number) => CHART_HEIGHT - (stars / top) * CHART_HEIGHT;
  const x = (_: StarPoint, index: number) => round(toX(times[index]!));
  const y = (point: StarPoint) => round(toY(point.stars));

  const yTicks: Tick[] = [];
  for (let value = 0; value <= top; value += step) {
    yTicks.push({ value, offset: round((toY(value) / CHART_HEIGHT) * 100) });
  }

  return {
    line: line<StarPoint>().x(x).y(y).curve(curveMonotoneX)(points) ?? '',
    area: area<StarPoint>().x(x).y0(CHART_HEIGHT).y1(y).curve(curveMonotoneX)(points) ?? '',
    yTicks,
    xTicks: yearTicks(first, last, toX),
    end: {
      x: 100,
      y: round((toY(points.at(-1)!.stars) / CHART_HEIGHT) * 100),
    },
  };
}
