import assert from 'node:assert/strict';
import test from 'node:test';

const { parseMetrics, sparklinePath, starSeries } = await import('./star-history.ts');

const snapshots = [
  { date: '2026-09-01', stars: { kuzu: 300, neo4j: 13000 } },
  { date: '2026-07-01', stars: { kuzu: 100 } },
  { date: '2026-08-01', stars: { kuzu: 200, neo4j: 12900 } },
];

test('metrics snapshots keep numeric star counts by slug', () => {
  const raw = {
    engines: [
      { slug: 'kuzu', github: { stars: 120 } },
      { slug: 'gone', github: null },
      { slug: 'odd', github: { stars: 'many' } },
    ],
  };
  assert.deepEqual(parseMetrics('2026-07-01', raw), {
    date: '2026-07-01',
    stars: { kuzu: 120 },
  });
  assert.deepEqual(parseMetrics('2026-07-01', {}).stars, {});
});

test('a series runs oldest first and ends with the live count today', () => {
  assert.deepEqual(starSeries(snapshots, 'kuzu', 310, '2026-11-03'), [
    { date: '2026-07-01', stars: 100 },
    { date: '2026-08-01', stars: 200 },
    { date: '2026-09-01', stars: 300 },
    { date: '2026-11-03', stars: 310 },
  ]);
});

test('a series skips snapshots without the engine and snapshots dated today or later', () => {
  const series = starSeries(snapshots, 'neo4j', 13100, '2026-09-01');
  assert.deepEqual(series, []);
  assert.equal(starSeries(snapshots, 'neo4j', 13100, '2026-11-03').length, 3);
});

test('too few points give no series', () => {
  assert.deepEqual(starSeries(snapshots, 'neo4j', null, '2026-11-03'), []);
  assert.deepEqual(starSeries(snapshots, 'missing', 5, '2026-11-03'), []);
});

test('the sparkline spans the box: time across, fewest stars at the bottom', () => {
  const points = [
    { date: '2026-01-01', stars: 10 },
    { date: '2026-01-03', stars: 30 },
    { date: '2026-01-05', stars: 20 },
  ];
  assert.equal(sparklinePath(points, 60, 20), 'M0 20L30 0L60 10');
});

test('an unchanged count is a midline, and one point draws nothing', () => {
  const flat = [
    { date: '2026-01-01', stars: 7 },
    { date: '2026-02-01', stars: 7 },
  ];
  assert.equal(sparklinePath(flat, 60, 20), 'M0 10L60 10');
  assert.equal(sparklinePath(flat.slice(0, 1), 60, 20), '');
});
