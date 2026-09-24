import { graphStratify, grid, laneGreedy } from 'd3-dag';
import { curveBumpX, line } from 'd3-shape';
import { RELATION_LABELS, RELATION_PHRASES, type Family, type Relation, type Station } from './lineage';

export interface LayoutOptions {
  /** Slug of the engine whose page this is; its station is drawn as "you are here". */
  highlight?: string;
  /** Widest the family is drawn before its time scale compresses to fit. */
  maxWidth?: number;
}

export interface PlacedStation {
  station: Station;
  x: number;
  y: number;
  radius: number;
  /** CSS colour for the station's line; undefined for stations outside the catalogue. */
  color?: string;
  labelLines: string[];
  caption: string;
  isHere: boolean;
}

export interface FamilyLayout {
  width: number;
  height: number;
  stations: PlacedStation[];
  routes: { d: string; color: string; style?: string }[];
  relationLabels: { text: string; x: number; y: number; width: number }[];
  /** The relationships as sentences, for screen readers and anyone who can't use the drawing. */
  descriptions: string[];
  /** x of the highlighted station, used to scroll narrow screens to it. */
  focusX?: number;
}

/** Compact top-to-bottom subway drawing. Every edge keeps its own route and style. */
export function layoutVerticalFamily(family: Family, horizontal = layoutFamily(family)): FamilyLayout {
  const lanes = [...new Set(horizontal.stations.map((station) => station.y))].sort((a, b) => a - b);
  const laneStep = Math.min(24, 96 / Math.max(1, lanes.length - 1));
  const width = 280;
  const trackLeft = (width - (lanes.length - 1) * laneStep) / 2;
  let cursor = 48;
  const stations = horizontal.stations.map((placed) => {
    const relations = new Set(placed.station.parents.map((parent) => parent.relation));
    // Reserve separate rows for incoming relation labels, including multi-parent joins.
    cursor += relations.size * 26;
    const station = { ...placed, x: trackLeft + lanes.indexOf(placed.y) * laneStep, y: cursor, labelLines: wrap(placed.station.label, 14) };
    cursor += 82;
    return station;
  });
  const byId = new Map(stations.map((placed) => [placed.station.id, placed]));
  const routes: FamilyLayout['routes'] = [];
  const relationLabels: FamilyLayout['relationLabels'] = [];
  for (const target of stations) {
    const relations = [...new Set(target.station.parents.map((parent) => parent.relation))];
    for (const parent of target.station.parents) {
      const source = byId.get(parent.id)!;
      const bendY = source.y + 30;
      // Change lanes below the source, then descend to the child.
      routes.push({
        d: source.x === target.x
          ? `M${source.x},${source.y}V${target.y}`
          : `M${source.x},${source.y}V${bendY - 12}C${source.x},${bendY + 12} ${target.x},${bendY + 12} ${target.x},${bendY + 36}V${target.y}`,
        color: target.color ?? 'var(--color-text-tertiary)',
        style: ROUTE_STYLES[parent.relation],
      });
    }
    relations.forEach((relation, index) => {
      const text = RELATION_LABELS[relation];
      const width = monoWidth(text) + PILL_PAD * 2;
      relationLabels.push({ text, width, x: target.x, y: target.y - 54 - index * 26 });
    });
  }
  return { width, height: cursor - 40, stations, routes, relationLabels, descriptions: horizontal.descriptions };
}

const LANE = 84;
const PAD_Y_TOP = 50;
const PAD_Y_BOTTOM = 36;
const PAD_X = 16;
const LABEL_WRAP = 18;
/** Horizontal run a branch needs to change lanes. */
const BEND = 44;
/** Minimum clear space between neighbouring stations' text on the same lane. */
const TEXT_GAP = 20;
/** Space kept between a station and the relation labels on its incoming line. */
const LABEL_PAD = 22;
/** Minimum stretch of visible line on either side of a relation label. */
const LINE_RUN = 38;
/** Padding inside the pill drawn behind a relation label. */
const PILL_PAD = 5;
// Horizontal scale bounds, in pixels per year. The scale is the smallest that gives every
// line the room its labels need, clamped so a short family isn't stretched and a long one
// isn't squashed; stations that still collide are nudged apart afterwards.
const MIN_PX_PER_YEAR = 22;
const MAX_PX_PER_YEAR = 90;
const DEFAULT_MAX_WIDTH = 880;
// Approximate advance widths, used to keep text from colliding. Labels are 14px Familjen
// Grotesk semibold; captions and relation labels are 12px IBM Plex Mono (0.6em advance).
const LABEL_CHAR = 8;
const MONO_CHAR = 7.2;
/** Number of `--lineage-N` colour tokens defined in global.css, assigned in order. */
const LINE_COLOR_COUNT = 8;
const ROUTE_STYLES: Partial<Record<Relation, string>> = {
  'inspired-by': 'is-dotted',
  'borrows-from': 'is-dashed',
};

function wrap(label: string, maxChars = LABEL_WRAP): string[] {
  const lines: string[] = [];
  for (const word of label.split(' ')) {
    const last = lines.at(-1);
    if (last && `${last} ${word}`.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

function caption(station: Station): string {
  return [station.released?.slice(0, 4), station.ended && 'ended'].filter(Boolean).join(' · ');
}

const monoWidth = (text: string) => text.length * MONO_CHAR;

/**
 * Lays out one family as a subway map: d3-dag's grid layout assigns each engine a lane, and x
 * follows release year within the family.
 */
export function layoutFamily(family: Family, options: LayoutOptions = {}): FamilyLayout {
  const { highlight, maxWidth = DEFAULT_MAX_WIDTH } = options;

  const dag = graphStratify()
    .id((s: Station) => s.id)
    .parentIds((s: Station) => s.parents.map((p) => p.id))(family.stations);
  // Bidirectional lanes let branches fan out on both sides of their parent's line.
  grid().lane(laneGreedy().bidirectional(true)).rank((node) => node.data.when)(dag);

  type DagNode = ReturnType<typeof dag.nodes> extends IterableIterator<infer N> ? N : never;
  const topological = [...dag.nodes()].sort((a, b) => a.y - b.y);
  const laneOf = (node: DagNode) => node.x;

  const isHere = (station: Station) => station.kind === 'current' && station.slug === highlight;
  const radius = (station: Station) => (isHere(station) ? 10 : station.kind === 'former' ? 6 : 8);

  /** Half the widest piece of text drawn above or below a station. */
  const halfWidth = (station: Station) => {
    const label = Math.max(...wrap(station.label).map((l) => l.length)) * LABEL_CHAR;
    return Math.max(label, monoWidth(caption(station)), radius(station) * 2) / 2;
  };

  // Relation labels sit on the target's incoming line, nearest the station first. A relation
  // shared by several parents is labelled once, since those lines run together into the station.
  const labelsByStation = new Map<string, { relation: Relation; offset: number; width: number }[]>();
  for (const node of topological) {
    const relations = [...new Set(node.data.parents.map((p) => p.relation))];
    let offset = radius(node.data) + LABEL_PAD;
    const labels = [];
    for (const relation of relations) {
      const width = monoWidth(RELATION_LABELS[relation]) + PILL_PAD * 2;
      labels.push({ relation, offset: offset + width, width });
      offset += width + LABEL_PAD;
    }
    labelsByStation.set(node.data.id, labels);
  }
  const labelFor = (target: Station, source: Station) => {
    const relation = target.parents.find((p) => p.id === source.id)?.relation;
    return labelsByStation.get(target.id)!.find((l) => l.relation === relation)!;
  };

  // When each station sits in time. Former names and uncatalogued ancestors have no release
  // date, so they are placed between their dated neighbours; a child never sits left of its parent.
  const times = new Map<DagNode, number>();
  for (const node of topological) {
    if (node.data.when !== undefined) times.set(node, node.data.when);
  }
  const datedChildren = (node: DagNode) =>
    [...node.children()].map((c) => times.get(c)).filter((t) => t !== undefined);
  for (const node of [...topological].reverse()) {
    if (times.has(node) || node.nparents() > 0) continue;
    const children = datedChildren(node);
    times.set(node, (children.length ? Math.min(...children) : 0) - 1);
  }
  for (const node of topological) {
    if (node.nparents() === 0) continue;
    const earliest = Math.max(...[...node.parents()].map((p) => times.get(p)!));
    if (!times.has(node)) {
      const children = datedChildren(node);
      const latest = children.length ? Math.min(...children) : earliest + 1;
      times.set(node, latest > earliest ? (earliest + latest) / 2 : earliest + 0.5);
    } else {
      times.set(node, Math.max(times.get(node)!, earliest));
    }
  }
  const byTime = [...topological].sort((a, b) => times.get(a)! - times.get(b)! || a.y - b.y);

  // Pixels needed between two stations on the same line, or between a parent and its child.
  const constraints: [DagNode, DagNode, number][] = [];
  const lastInLane = new Map<number, DagNode>();
  for (const node of byTime) {
    const previous = lastInLane.get(laneOf(node));
    if (previous) {
      constraints.push([previous, node, halfWidth(previous.data) + TEXT_GAP + halfWidth(node.data)]);
    }
    lastInLane.set(laneOf(node), node);
    for (const parent of node.parents()) {
      const bent = laneOf(parent) !== laneOf(node);
      const clear = bent ? halfWidth(parent.data) + BEND : radius(parent.data);
      constraints.push([parent, node, clear + LINE_RUN + labelFor(node.data, parent.data).offset]);
    }
  }

  let pxPerYear = MIN_PX_PER_YEAR;
  for (const [left, right, gap] of constraints) {
    const years = times.get(right)! - times.get(left)!;
    if (years > 0.05) pxPerYear = Math.max(pxPerYear, gap / years);
  }
  pxPerYear = Math.min(pxPerYear, MAX_PX_PER_YEAR);
  // Fitting the available width wins over the minimum scale; nudging below keeps text apart.
  const allTimes = byTime.map((n) => times.get(n)!);
  const span = Math.max(...allTimes) - Math.min(...allTimes);
  const textAllowance = Math.max(...byTime.map((n) => halfWidth(n.data))) * 2 + PAD_X * 2;
  if (span > 0) pxPerYear = Math.min(pxPerYear, Math.max(0, maxWidth - textAllowance) / span);

  const start = Math.min(...byTime.map((n) => times.get(n)! * pxPerYear - halfWidth(n.data)));
  const xOf = new Map<DagNode, number>();
  for (const node of byTime) xOf.set(node, times.get(node)! * pxPerYear - start + PAD_X);
  // Nudge apart anything the clamped scale left too close, in time order so pushes cascade.
  for (const node of byTime) {
    let x = xOf.get(node)!;
    for (const [left, right, gap] of constraints) {
      if (right === node) x = Math.max(x, xOf.get(left)! + gap);
    }
    xOf.set(node, x);
  }

  const lanes = [...new Set(topological.map(laneOf))].sort((a, b) => a - b);
  const yOf = (node: DagNode) => PAD_Y_TOP + lanes.indexOf(laneOf(node)) * LANE;

  // Lines take hues in a fixed order, earliest engine first. A family with more lines than
  // validated hues draws the rest in neutral ink rather than repeating a colour.
  const lineColor = new Map<string, string>();
  const colorFor = (station: Station) => {
    const key = station.slug ?? station.id;
    if (!lineColor.has(key)) {
      const slot = lineColor.size + 1;
      lineColor.set(key, slot <= LINE_COLOR_COUNT ? `var(--lineage-${slot})` : 'var(--color-text-tertiary)');
    }
    return lineColor.get(key)!;
  };

  const stations: PlacedStation[] = byTime.map((node) => ({
    station: node.data,
    x: xOf.get(node)!,
    y: yOf(node),
    radius: radius(node.data),
    color: node.data.kind === 'external' ? undefined : colorFor(node.data),
    labelLines: wrap(node.data.label),
    caption: caption(node.data),
    isHere: isHere(node.data),
  }));

  const route = line().curve(curveBumpX);
  const routes = [...dag.links()].map((link) => {
    const [sx, sy] = [xOf.get(link.source)!, yOf(link.source)];
    const [tx, ty] = [xOf.get(link.target)!, yOf(link.target)];
    const label = labelFor(link.target.data, link.source.data);
    // Leave the parent clear of its own text, and finish the bend before this line's label.
    const points: [number, number][] = sy === ty
      ? [[sx, sy], [tx, ty]]
      : [[sx, sy], [sx + halfWidth(link.source.data), sy], [tx - label.offset - LINE_RUN, ty], [tx, ty]];
    return { d: route(points) ?? '', color: colorFor(link.target.data), style: ROUTE_STYLES[label.relation] };
  });

  // A lone straight line carries its label at its midpoint; where lines bend or several labels
  // share one line, labels stack from the station outwards so each stays on its own route.
  const relationLabels = byTime.flatMap((node) => {
    const parents = [...node.parents()];
    const straightParent = parents.length === 1 && laneOf(parents[0]) === laneOf(node) ? parents[0] : undefined;
    const x = xOf.get(node)!;
    return labelsByStation.get(node.data.id)!.map((label) => ({
      text: RELATION_LABELS[label.relation],
      x: straightParent
        ? (xOf.get(straightParent)! + radius(straightParent.data) + x - radius(node.data)) / 2
        : x - label.offset + label.width / 2,
      y: yOf(node),
      width: label.width,
    }));
  });

  const labelById = new Map(family.stations.map((s) => [s.id, s.label]));
  const descriptions = byTime
    .filter((node) => node.data.parents.length > 0 || node.data.ended)
    .map(({ data }) => {
      const when = data.released ? `, ${data.released.slice(0, 4)}` : '';
      const origins = data.parents.map((p) => `${RELATION_PHRASES[p.relation]} ${labelById.get(p.id)}`);
      const ended = data.ended ? ['no longer developed'] : [];
      return `${data.label}${when}: ${[...origins, ...ended].join('; ')}.`;
    });

  return {
    width: Math.max(...stations.map((s) => s.x + halfWidth(s.station))) + PAD_X,
    height: PAD_Y_TOP + PAD_Y_BOTTOM + (lanes.length - 1) * LANE,
    stations,
    routes,
    relationLabels,
    descriptions,
    focusX: stations.find((s) => s.isHere)?.x,
  };
}
