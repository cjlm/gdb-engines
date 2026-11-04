import { hasModifierKey } from '../../lib/plain-click.mjs';
import { layoutMobileTimeline } from '../../lib/timeline-mobile-layout.mjs';
import {
  fallbackLabelPosition,
  fitBeeswarm,
  labelPositions,
  rectanglesOverlap,
  releasePoint,
  yearsDescending,
} from '../../lib/timeline-beeswarm.mjs';
import { registerGraphView, setViewSelection, setViewStatus } from './view-registry';

const VIEW_ID = 'timeline';
const compactLayout = window.matchMedia('(max-width: 48rem)');

interface TimelineParts {
  timeline: HTMLElement;
  stage: HTMLElement;
  statusRow: HTMLElement;
  scroll: HTMLElement;
  canvas: HTMLElement;
  key: HTMLElement;
  items: HTMLLIElement[];
  nodes: HTMLAnchorElement[];
}

function findParts(timeline: HTMLElement): TimelineParts {
  const stage = timeline.closest<HTMLElement>('.graph-stage');
  const statusRow = stage?.querySelector<HTMLElement>('.graph-status-row');
  const scroll = timeline.querySelector<HTMLElement>('.timeline-scroll');
  const canvas = timeline.querySelector<HTMLElement>('.timeline-canvas');
  const key = timeline.querySelector<HTMLElement>('.timeline-key');
  if (!stage || !statusRow || !scroll || !canvas || !key) {
    throw new Error('Timeline view: expected inside .graph-stage, with scroll, canvas and key.');
  }
  return {
    timeline,
    stage,
    statusRow,
    scroll,
    canvas,
    key,
    items: [...timeline.querySelectorAll<HTMLLIElement>('.timeline-item')],
    nodes: [...timeline.querySelectorAll<HTMLAnchorElement>('.timeline-node')],
  };
}

/** On wide screens the stage grows to show the whole timeline without an inner scrollbar. */
function syncStageHeight(parts: TimelineParts) {
  if (!parts.stage.classList.contains('timeline-active')) return;
  if (compactLayout.matches) {
    parts.stage.style.removeProperty('height');
    return;
  }
  const scrollbarHeight = parts.scroll.offsetHeight - parts.scroll.clientHeight;
  const height =
    parts.statusRow.offsetHeight +
    parts.canvas.offsetHeight +
    parts.key.offsetHeight +
    scrollbarHeight +
    2;
  parts.stage.style.height = `${height}px`;
}

function placeLabel(label: HTMLElement, isRight: boolean, isFree: (rect: DOMRect) => boolean) {
  for (const position of labelPositions(isRight)) {
    label.dataset.position = position;
    const rect = label.getBoundingClientRect();
    if (isFree(rect)) return rect;
  }
  label.dataset.position = fallbackLabelPosition(isRight);
  return null;
}

/** Show each node's label where it fits clear of the canvas edge, year labels and other nodes. */
function revealLabels({ timeline, canvas, items, nodes }: TimelineParts) {
  const canvasRect = canvas.getBoundingClientRect();
  const yearLabelRects = [
    ...canvas.querySelectorAll<HTMLElement>('.timeline-year-tick > span, .timeline-unknown-label'),
  ].map((label) => label.getBoundingClientRect());
  const nodeRects = nodes.map((node) => node.getBoundingClientRect());
  const visibleLabelRects: DOMRect[] = [];

  const touchesAny = (rect: DOMRect, others: DOMRect[]) =>
    others.some((other) => rectanglesOverlap(rect, other));

  for (const [index, item] of items.entries()) {
    item.classList.remove('timeline-item--label-visible');
    const label = item.querySelector<HTMLElement>('.timeline-node-label');
    if (!label) continue;
    const otherNodeRects = nodeRects.filter((_, nodeIndex) => nodeIndex !== index);
    const isFree = (rect: DOMRect) =>
      rect.left >= canvasRect.left + 6 &&
      rect.right <= canvasRect.right - 6 &&
      rect.top >= canvasRect.top + 6 &&
      rect.bottom <= canvasRect.bottom - 6 &&
      !touchesAny(rect, yearLabelRects) &&
      !touchesAny(rect, otherNodeRects) &&
      !touchesAny(rect, visibleLabelRects);
    const placed = placeLabel(label, item.classList.contains('timeline-item--right'), isFree);
    if (placed) {
      item.classList.add('timeline-item--label-visible');
      visibleLabelRects.push(placed);
    }
  }
  timeline.dataset.visibleLabels = String(visibleLabelRects.length);
}

function setSide(item: HTMLLIElement, x: number) {
  item.classList.toggle('timeline-item--right', x >= 0);
  item.classList.toggle('timeline-item--left', x < 0);
}

function setNodeSize(timeline: HTMLElement, nodeSize: number) {
  timeline.style.setProperty('--timeline-node-size', `${nodeSize}px`);
  timeline.dataset.nodeSize = String(nodeSize);
}

/** Phones get a packed layout in which busy years take more height. */
function layoutCompact({ timeline, canvas, items }: TimelineParts) {
  const years = yearsDescending(
    Number(timeline.dataset.startYear),
    Number(timeline.dataset.endYear),
  );
  const points = items.map((item, id) => ({ id, ...releasePoint(item.dataset.release) }));
  const layout = layoutMobileTimeline(points, years, canvas.clientWidth);
  setNodeSize(timeline, layout.nodeSize);
  canvas.style.height = `${layout.height}px`;
  const ticks = [...timeline.querySelectorAll<HTMLElement>('.timeline-year-tick')];
  const unknownLabel = timeline.querySelector<HTMLElement>('.timeline-unknown-label');
  for (const [index, { year, y }] of layout.ticks.entries()) {
    const tick = year === null ? unknownLabel : ticks[index];
    if (tick) tick.style.top = `${y}px`;
  }
  const axis = timeline.querySelector<HTMLElement>('.timeline-axis-line');
  const firstTick = layout.ticks[0];
  const lastTick = layout.ticks.at(-1);
  if (axis && firstTick && lastTick) {
    axis.style.top = `${firstTick.y}px`;
    axis.style.height = `${lastTick.y - firstTick.y}px`;
  }
  for (const [index, item] of items.entries()) {
    const point = layout.positions.get(index);
    if (!point) continue;
    item.style.top = `${point.y}px`;
    item.style.left = `calc(50% + ${point.x}px)`;
    setSide(item, point.x);
  }
}

/** Wide screens keep a uniform time scale and spread crowded releases sideways. */
function layoutWide({ timeline, canvas, items }: TimelineParts): boolean {
  // Restore the uniform desktop time scale after resizing from mobile.
  canvas.style.removeProperty('height');
  for (const item of items) item.style.removeProperty('top');
  const marks = timeline.querySelectorAll<HTMLElement>(
    '.timeline-year-tick, .timeline-unknown-label, .timeline-axis-line',
  );
  for (const mark of marks) {
    mark.style.removeProperty('top');
    mark.style.removeProperty('height');
  }
  const ys = items.map((item) => Number(item.dataset.timelineY ?? 0));
  const fitted = fitBeeswarm(ys, canvas.clientWidth);
  if (!fitted) return false;
  setNodeSize(timeline, fitted.nodeSize);
  for (const [index, item] of items.entries()) {
    const x = fitted.positions[index] ?? 0;
    item.style.left = `calc(50% + ${x.toFixed(2)}px)`;
    setSide(item, x);
  }
  return true;
}

function layout(parts: TimelineParts) {
  if (parts.items.length === 0 || parts.canvas.clientWidth === 0) return;
  if (compactLayout.matches) {
    layoutCompact(parts);
  } else if (!layoutWide(parts)) {
    return;
  }
  revealLabels(parts);
  syncStageHeight(parts);
}

/** On phones the first tap on a node shows its details and a second tap opens it. */
function selectOnFirstTap(nodes: HTMLAnchorElement[]) {
  let selectedNode: HTMLAnchorElement | null = null;
  for (const node of nodes) {
    node.addEventListener('click', (event) => {
      if (!compactLayout.matches || hasModifierKey(event) || event.detail === 0) return;
      if (selectedNode === node) return;
      event.preventDefault();
      selectedNode = node;
      node.focus({ preventScroll: true });
      const item = node.closest('.timeline-item');
      setViewSelection(VIEW_ID, {
        label: item?.querySelector('.timeline-node-label-name')?.textContent ?? '',
        imageUrl: node.querySelector('img')?.src ?? '',
        href: node.href,
        detail: item?.querySelector('.timeline-node-label-date')?.textContent ?? '',
      });
    });
  }
}

function timelineStatus(timeline: HTMLElement): string {
  const undatedCount = Number(timeline.dataset.undatedCount ?? 0);
  const range = `${timeline.dataset.startYear}–${timeline.dataset.endYear}`;
  return undatedCount ? `${range} · ${undatedCount} unconfirmed` : range;
}

export function mountTimelineView(timeline: HTMLElement) {
  const parts = findParts(timeline);
  let layoutFrame = 0;
  const scheduleLayout = () => {
    if (layoutFrame !== 0) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      layout(parts);
    });
  };
  const syncHeight = () => syncStageHeight(parts);

  const stageObserver = new ResizeObserver(syncHeight);
  stageObserver.observe(parts.statusRow);
  stageObserver.observe(parts.key);
  const layoutObserver = new ResizeObserver(scheduleLayout);
  layoutObserver.observe(parts.canvas);
  window.addEventListener('resize', syncHeight);
  selectOnFirstTap(parts.nodes);
  setViewStatus(VIEW_ID, timelineStatus(timeline));

  registerGraphView(VIEW_ID, {
    activate() {
      layout(parts);
    },
    shown() {
      timeline.style.removeProperty('height');
      parts.scroll.tabIndex = -1;
      syncHeight();
    },
    deactivate() {
      // Keep the outgoing timeline's size while it fades out under the next view, so its key
      // does not jump up as the stage shrinks back.
      if (parts.stage.classList.contains('timeline-active')) {
        timeline.style.height = `${timeline.getBoundingClientRect().height}px`;
      }
      parts.stage.style.removeProperty('height');
    },
  });

  window.addEventListener(
    'pagehide',
    () => {
      window.removeEventListener('resize', syncHeight);
      stageObserver.disconnect();
      layoutObserver.disconnect();
      if (layoutFrame !== 0) cancelAnimationFrame(layoutFrame);
    },
    { once: true },
  );
}
