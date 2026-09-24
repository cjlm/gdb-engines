import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutMobileTimeline } from './timeline-mobile-layout.mjs';

test('dense releases stay inside a phone plot without overlapping or losing nodes', () => {
  const items = Array.from({ length: 35 }, (_, id) => ({ id, year: 2026, fraction: 0.5 }));
  items.push({ id: 35, year: 2025, fraction: 0.9 }, { id: 36, year: null, fraction: 0.5 });
  for (const width of [260, 330, 370, 700]) {
    const result = layoutMobileTimeline(items, [2026, 2025, 2024], width);
    assert.equal(result.positions.size, items.length);
    const points = [...result.positions.values()];
    for (const [index, point] of points.entries()) {
      assert(Math.abs(point.x) + result.nodeSize / 2 <= width / 2);
      assert(point.y + result.nodeSize / 2 <= result.height);
      for (const other of points.slice(index + 1)) {
        assert(Math.hypot(point.x - other.x, point.y - other.y) >= result.nodeSize + 5);
      }
    }
    for (const item of items) {
      const tick = result.ticks.findIndex((tick) => tick.year === item.year);
      assert(result.positions.get(item.id).y > result.ticks[tick].y);
      assert(result.positions.get(item.id).y < (result.ticks[tick + 1]?.y ?? result.height));
    }
  }
});

test('release order survives crowding and sparse years remain compact', () => {
  const items = Array.from({ length: 24 }, (_, id) => ({ id, year: 2026, fraction: 1 - id / 24 }));
  const { positions, ticks } = layoutMobileTimeline(items, [2026, 2025, 2024], 260);
  for (let id = 1; id < items.length; id++) assert(positions.get(id).y >= positions.get(id - 1).y);
  assert(ticks[1].y - ticks[0].y > ticks[2].y - ticks[1].y);
});
