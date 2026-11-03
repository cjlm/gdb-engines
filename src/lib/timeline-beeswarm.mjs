const MAXIMUM_NODE_SIZE = 40;
const MINIMUM_NODE_SIZE = 18;

function byDistanceThenSide(preferredSign) {
  return (left, right) => {
    const distance = Math.abs(left) - Math.abs(right);
    if (Math.abs(distance) > 0.01) return distance;
    const leftPreferred = Math.sign(left) === preferredSign;
    const rightPreferred = Math.sign(right) === preferredSign;
    return Number(rightPreferred) - Number(leftPreferred);
  };
}

/**
 * Place nodes either side of a vertical axis so none overlap, keeping each at its y.
 *
 * Args:
 *   ys: each node's vertical position, in placement order.
 *   nodeSize: node diameter in pixels.
 *   canvasWidth: width of the plot; the axis runs down its middle.
 *
 * Returns:
 *   Each node's horizontal offset from the axis, or null when they cannot all fit.
 */
export function beeswarmPositions(ys, nodeSize, canvasWidth) {
  const radius = nodeSize / 2;
  const minimumDistance = nodeSize + 5;
  const minimumDistanceSquared = minimumDistance ** 2;
  const centerClearance = radius + 30;
  const maximumOffset = canvasWidth / 2 - radius - 10;
  if (centerClearance > maximumOffset) return null;

  const placed = [];
  for (const [index, y] of ys.entries()) {
    const nearby = placed.filter((point) => Math.abs(y - point.y) < minimumDistance);
    const candidates = [centerClearance, -centerClearance];
    for (const point of nearby) {
      const tangentX = Math.sqrt(Math.max(0, minimumDistanceSquared - (y - point.y) ** 2));
      candidates.push(point.x - tangentX, point.x + tangentX);
    }
    const ordered = candidates.toSorted(byDistanceThenSide(index % 2 === 0 ? 1 : -1));

    const x = ordered.find((candidate) => {
      const offset = Math.abs(candidate);
      if (offset < centerClearance - 0.01 || offset > maximumOffset + 0.01) return false;
      return nearby.every(
        (point) => (candidate - point.x) ** 2 + (y - point.y) ** 2 >= minimumDistanceSquared - 0.1,
      );
    });
    if (x === undefined) return null;
    placed.push({ x, y });
  }
  return placed.map((point) => point.x);
}

/**
 * Find the largest even-stepped node size whose beeswarm fits the canvas.
 *
 * Returns:
 *   `{ nodeSize, positions }`, or null when even the smallest nodes do not fit.
 */
export function fitBeeswarm(ys, canvasWidth) {
  let nodeSize = Math.min(MAXIMUM_NODE_SIZE, Math.floor(canvasWidth / 5));
  for (; nodeSize >= MINIMUM_NODE_SIZE; nodeSize -= 2) {
    const positions = beeswarmPositions(ys, nodeSize, canvasWidth);
    if (positions) return { nodeSize, positions };
  }
  return null;
}

/** Whether two rectangles touch, counting a 3px gap as touching. */
export function rectanglesOverlap(left, right) {
  return !(
    left.right + 3 <= right.left ||
    left.left >= right.right + 3 ||
    left.bottom + 3 <= right.top ||
    left.top >= right.bottom + 3
  );
}

const RIGHT_LABEL_POSITIONS = [
  'right',
  'right-up',
  'right-down',
  'above-right',
  'below-right',
  'above',
  'below',
  'left',
];
const LEFT_LABEL_POSITIONS = [
  'left',
  'left-up',
  'left-down',
  'above-left',
  'below-left',
  'above',
  'below',
  'right',
];

/** Label positions to try, outward from the axis first, for a node on either side of it. */
export function labelPositions(isRight) {
  return isRight ? RIGHT_LABEL_POSITIONS : LEFT_LABEL_POSITIONS;
}

/** Where a label goes when no position is free; it then shows only on hover or focus. */
export function fallbackLabelPosition(isRight) {
  return isRight ? 'above-left' : 'above-right';
}

/** A YYYY or YYYY-MM release as a year and the fraction of that year it falls at. */
export function releasePoint(release) {
  const [year, month] = (release ?? '').split('-').map(Number);
  return { year: year || null, fraction: month ? (month - 0.5) / 12 : 0.5 };
}

/** Years from end back to start, newest first. */
export function yearsDescending(startYear, endYear) {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => endYear - index);
}
