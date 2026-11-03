import assert from 'node:assert/strict';
import test from 'node:test';

const { layoutRankChart, monthLabel } = await import('./rank-chart.ts');

const series = (slug, ranks, inCurrentTop) => ({
  slug,
  name: slug,
  points: ranks.map((rank, index) => ({ month: `2026-0${index + 5}`, rank })),
  current: ranks.at(-1),
  inCurrentTop,
});

test('rank 1 is drawn above rank 2, and ranks outside the top N on the edge below', () => {
  const chart = layoutRankChart(
    [series('a', [1, 2, 1], true), series('b', [2, 1, 5], false)],
    2
  );
  const [a, b] = chart.lines;
  assert.ok(a.markers[0].y < b.markers[0].y);
  assert.ok(chart.rows[0].y < chart.rows[1].y);
  assert.equal(b.markers.at(-1).y, chart.edgeY);
  assert.ok(chart.edgeY > chart.rows[1].y);
  assert.equal(b.markers.at(-1).inTop, false);
  assert.equal(b.markers.at(-1).label, '5');
});

test('entering and leaving the top N draw a stub to the edge', () => {
  const chart = layoutRankChart(
    [series('steady', [1, 1, 1], true), series('leaver', [2, 9, null], false)],
    2
  );
  const [steady, leaver] = chart.lines;
  assert.equal(steady.stubs.length, 0);
  assert.equal(leaver.stubs.length, 1);
  assert.deepEqual(
    leaver.markers.map((marker) => marker.label),
    ['2', '9']
  );
});

test('a month outside the top N between two inside it dips to the edge and back', () => {
  const chart = layoutRankChart([series('dip', [1, 7, 1], true)], 2);
  assert.equal(chart.lines[0].stubs.length, 2);
  assert.equal(chart.lines[0].markers.length, 3);
});

test('unranked months show an en dash', () => {
  const chart = layoutRankChart([series('new', [null, 2, 1], true)], 2);
  assert.equal(chart.lines[0].markers[0].label, '–');
});

test('names sit at the right end for the current top N and after the last month in it', () => {
  const chart = layoutRankChart(
    [series('a', [1, 1, 1], true), series('b', [2, 9, 9], false)],
    2
  );
  const [a, b] = chart.lines;
  assert.ok(a.label.x > a.markers.at(-1).x);
  assert.equal(a.label.y, chart.rows[0].y);
  assert.ok(b.label.x < a.label.x);
  assert.equal(b.label.y, chart.rows[1].y);
});

test('the chart has one column per month and one row per rank', () => {
  const chart = layoutRankChart([series('a', [1, 1, 1], true)], 10);
  assert.equal(chart.columns.length, 3);
  assert.equal(chart.rows.length, 10);
  assert.ok(chart.width > chart.columns.at(-1).x);
  assert.ok(chart.height > chart.edgeY);
});

test('months are labelled with the year on the first column and in January', () => {
  assert.deepEqual(monthLabel('2026-05', 0), { label: 'May', year: '2026' });
  assert.deepEqual(monthLabel('2026-06', 1), { label: 'Jun', year: null });
  assert.deepEqual(monthLabel('2027-01', 8), { label: 'Jan', year: '2027' });
});
