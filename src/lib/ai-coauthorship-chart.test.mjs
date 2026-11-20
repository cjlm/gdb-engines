import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const {
  ageScale,
  ageX,
  ageY,
  monthlyChart,
  placeLabels,
  scatterX,
  scatterY,
  totals,
} = await import(
  './ai-coauthorship-chart.ts'
);
// Chart data is synced from the blog repo (scripts/sync-blog.mjs); without it, skip the data check.
const dataFile = new URL('../data/blog/ai-coauthorship.json', import.meta.url);
const data = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile)) : null;

test('data matches the totals in the captions', { skip: !data && 'chart data not synced' }, () => {
  assert.equal(data.repos.length, 90);
  assert.deepEqual(totals(data.repos), { commits: 70_971, aiCommits: 11_884, aiPct: 16.7 });
  assert.deepEqual(totals(data.monthly), totals(data.repos));
  assert.equal(data.repos.filter((repo) => repo.commits >= 100).length, 56);
});

test('commits sit on a log scale from 100 to 10,000, clamped', () => {
  assert.equal(scatterX(100), 0);
  assert.equal(scatterX(1_000), 50);
  assert.equal(scatterX(10_000), 100);
  assert.equal(scatterX(50), 0);
  assert.equal(scatterX(20_000), 100);
});

test('share runs from the bottom (0%) to the top (100%)', () => {
  assert.equal(scatterY(0), 100);
  assert.equal(scatterY(64.1), 35.9);
  assert.equal(scatterY(120), 0);
});

test('labels go beside their mark, avoiding marks, other labels and the edge', () => {
  const marks = [
    { x: 20, y: 50 },
    { x: 60, y: 50 },
    { x: 190, y: 50 },
  ];
  const label = { width: 30, height: 12 };
  const area = { left: 0, right: 200, top: 0, bottom: 100 };
  const placed = placeLabels(marks, 24, [label, label, label], [0, 1, 2], area);
  assert.deepEqual(
    placed.map((placement) => placement?.side),
    ['above', 'right', 'left'],
  );
  assert.ok(placed.every((placement) => placement?.lift === 0));
});

test('a boxed-in label is lifted above its neighbours, or dropped when nothing fits', () => {
  const row = [80, 104, 128].map((x) => ({ x, y: 100 }));
  const stacked = [...row, { x: 104, y: 76 }, { x: 104, y: 124 }];
  const area = { left: 0, right: 200, top: 0, bottom: 150 };
  const label = { width: 40, height: 12 };
  const labels = stacked.map((_, index) => (index === 1 ? label : null));
  const [, middle] = placeLabels(stacked, 24, labels, [1], area);
  assert.equal(middle?.side, 'above');
  assert.ok(middle.lift > 0);
  const tight = { left: 0, right: 30, top: 0, bottom: 30 };
  assert.deepEqual(placeLabels([{ x: 15, y: 15 }], 24, [{ width: 300, height: 9 }], [0], tight), [
    null,
  ]);
});

test('age view: square-root share, newest years at the top, dots sized by commits', () => {
  assert.equal(ageX(0), 0);
  assert.equal(ageX(25), 50);
  assert.equal(ageX(100), 100);
  assert.ok(ageY(2026) < ageY(2006));
  assert.equal(ageScale(100, 7_522), Math.round((6 / 16) * 100) / 100);
  assert.equal(ageScale(7_522, 7_522), 1);
  assert.ok(ageScale(1_000, 7_522) > ageScale(500, 7_522));
});

test('every repository has a first-commit year', { skip: !data && 'chart data not synced' }, () => {
  for (const repo of data.repos) assert.ok(repo.firstYear >= 1990 && repo.firstYear <= 2026, repo.slug);
});

test('unlabelled marks get no side', () => {
  const area = { left: 0, right: 200, top: 0, bottom: 100 };
  assert.deepEqual(placeLabels([{ x: 50, y: 50 }], 24, [null], [], area), [null]);
});

test('monthly points span the width on a 0-25% scale', { skip: !data && 'chart data not synced' }, () => {
  const chart = monthlyChart(data.monthly);
  assert.equal(chart.points.length, 13);
  assert.equal(chart.points[0].x, 0);
  assert.equal(chart.points.at(-1).x, 100);
  assert.equal(chart.points[0].y, 82);
  assert.ok(chart.line.startsWith('M0,'));
});
