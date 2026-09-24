/** Pack a narrow timeline without shrinking its nodes or losing releases to overlap.
 * Years retain their order; dense years get more vertical room. Dates within each
 * year set the preferred y, and ties spread across the available horizontal lanes.
 */
export function layoutMobileTimeline(items, years, width) {
  const nodeSize = 32;
  const gap = nodeSize + 8;
  const maxX = width / 2 - nodeSize / 2 - 10;
  const lanes = [];
  for (let x = nodeSize / 2 + 26; x <= maxX; x += gap) lanes.push(x, -x);
  if (!lanes.length) lanes.push(Math.max(20, maxX), -Math.max(20, maxX));
  const positions = new Map();
  const ticks = [];
  let top = 26;
  for (const year of [...years, null]) {
    const group = items.filter((item) => item.year === year);
    if (year === null && !group.length) continue;
    ticks.push({ year, y: top });
    // Start with a compact year. Collision packing alone adds space where needed;
    // reserving room by count as well would stretch dense years twice.
    const nominalHeight = 88;
    const placed = [];
    let previousY = top + 32;
    for (const [index, item] of group.entries()) {
      let y = Math.max(previousY, top + 32 + (1 - item.fraction) * 40);
      const candidates = index % 2 ? [...lanes.slice(1), lanes[0]] : lanes;
      let x;
      while (x === undefined) {
        x = candidates.find((candidate) => placed.every((point) =>
          (candidate - point.x) ** 2 + (y - point.y) ** 2 >= gap ** 2));
        if (x === undefined) y += 4;
      }
      const point = { x, y };
      placed.push(point);
      positions.set(item.id, point);
      previousY = y;
    }
    top = Math.max(top + nominalHeight, previousY + 32);
  }
  return { positions, ticks, height: top + 12, nodeSize };
}
