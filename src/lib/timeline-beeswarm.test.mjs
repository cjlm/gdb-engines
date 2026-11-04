import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beeswarmPositions,
  fallbackLabelPosition,
  fitBeeswarm,
  labelPositions,
  rectanglesOverlap,
  releasePoint,
  yearsDescending,
} from './timeline-beeswarm.mjs';

function assertNoOverlap(ys, xs, nodeSize) {
  for (let left = 0; left < ys.length; left += 1) {
    for (let right = left + 1; right < ys.length; right += 1) {
      const distance = Math.hypot(xs[left] - xs[right], ys[left] - ys[right]);
      assert.ok(distance >= nodeSize + 5 - 0.01, `nodes ${left} and ${right} overlap`);
    }
  }
}

test('lone nodes alternate either side of the axis just clear of it', () => {
  const xs = beeswarmPositions([0, 200, 400], 20, 600);
  assert.deepEqual(xs, [40, -40, 40]);
});

test('crowded nodes at one date spread outward without overlapping or crossing the edge', () => {
  const ys = Array.from({ length: 9 }, () => 100);
  const xs = beeswarmPositions(ys, 20, 600);
  assert.ok(xs);
  assertNoOverlap(ys, xs, 20);
  for (const x of xs) {
    assert.ok(Math.abs(x) >= 40 - 0.01, 'node sits on the axis');
    assert.ok(Math.abs(x) <= 600 / 2 - 10 - 10 + 0.01, 'node leaves the canvas');
  }
});

test('crowded nodes spread outward from the axis, nearest free spot first', () => {
  assert.deepEqual(beeswarmPositions([0, 0, 0, 0, 0], 20, 300), [40, -40, 65, -65, 90]);
  assert.deepEqual(beeswarmPositions([0, 10, 20, 30, 40], 20, 300), [40, -40, 55, -55, 40]);
});

test('a node takes the free spot nearest the axis even on its less preferred side', () => {
  assert.deepEqual(beeswarmPositions([0, 100, 0], 20, 300), [40, -40, -40]);
});

test('keeps ten pixels between nodes and the canvas edge', () => {
  assert.deepEqual(beeswarmPositions([0, 0, 0], 20, 170), [40, -40, 65]);
  assert.equal(beeswarmPositions([0, 0, 0], 20, 150), null);
});

test('gives up when the nodes cannot fit the width', () => {
  assert.equal(beeswarmPositions([0], 40, 100), null);
  assert.equal(beeswarmPositions([], 40, 100), null);
  assert.equal(beeswarmPositions(Array.from({ length: 12 }, () => 0), 20, 200), null);
});

test('fits the largest node size that leaves every node clear', () => {
  assert.deepEqual(fitBeeswarm([0, 100], 600), { nodeSize: 40, positions: [50, -50] });
  const crowded = Array.from({ length: 8 }, () => 0);
  const fitted = fitBeeswarm(crowded, 300);
  assert.ok(fitted);
  assert.ok(fitted.nodeSize < 40 && fitted.nodeSize >= 18);
  assert.equal(fitted.nodeSize % 2, 0);
  assert.equal(beeswarmPositions(crowded, fitted.nodeSize + 2, 300), null);
  assertNoOverlap(crowded, fitted.positions, fitted.nodeSize);
});

test('narrow canvases cap the node size at a fifth of the width', () => {
  assert.equal(fitBeeswarm([0], 150)?.nodeSize, 30);
  assert.equal(fitBeeswarm([0], 80), null);
});

test('never shrinks nodes below 18 pixels to make them fit', () => {
  assert.equal(beeswarmPositions([0, 0, 0], 14, 150)?.length, 3);
  assert.equal(fitBeeswarm([0, 0, 0], 150), null);
});

test('rectangles closer than three pixels count as touching', () => {
  const box = { left: 0, right: 10, top: 0, bottom: 10 };
  assert.equal(rectanglesOverlap(box, { left: 12, right: 20, top: 0, bottom: 10 }), true);
  assert.equal(rectanglesOverlap(box, { left: 13, right: 20, top: 0, bottom: 10 }), false);
  assert.equal(rectanglesOverlap(box, { left: -20, right: -3, top: 0, bottom: 10 }), false);
  assert.equal(rectanglesOverlap(box, { left: -20, right: -2, top: 0, bottom: 10 }), true);
  assert.equal(rectanglesOverlap(box, { left: 0, right: 10, top: 13, bottom: 20 }), false);
  assert.equal(rectanglesOverlap(box, { left: 0, right: 10, top: 12.5, bottom: 20 }), true);
  assert.equal(rectanglesOverlap(box, { left: 0, right: 10, top: -20, bottom: -3 }), false);
  assert.equal(rectanglesOverlap(box, { left: 0, right: 10, top: -20, bottom: -2 }), true);
});

test('labels try the side away from the axis first and fall back above it', () => {
  assert.equal(labelPositions(true)[0], 'right');
  assert.equal(labelPositions(true).at(-1), 'left');
  assert.equal(labelPositions(false)[0], 'left');
  assert.equal(labelPositions(false).at(-1), 'right');
  assert.equal(labelPositions(true).length, 8);
  assert.equal(fallbackLabelPosition(true), 'above-left');
  assert.equal(fallbackLabelPosition(false), 'above-right');
});

test('reads month releases mid-month and year-only releases mid-year', () => {
  assert.deepEqual(releasePoint('2020-01'), { year: 2020, fraction: 0.5 / 12 });
  assert.deepEqual(releasePoint('2020-12'), { year: 2020, fraction: 11.5 / 12 });
  assert.deepEqual(releasePoint('2019'), { year: 2019, fraction: 0.5 });
  assert.deepEqual(releasePoint(''), { year: null, fraction: 0.5 });
  assert.deepEqual(releasePoint(), { year: null, fraction: 0.5 });
});

test('lists years newest first, inclusive', () => {
  assert.deepEqual(yearsDescending(2019, 2022), [2022, 2021, 2020, 2019]);
  assert.deepEqual(yearsDescending(2020, 2020), [2020]);
});
