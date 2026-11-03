import assert from 'node:assert/strict';
import test from 'node:test';

const { parseBackfill, parseMetrics, repoKey, starSeries } = await import('./star-history.ts');

const snapshots = [
  { date: '2026-09-01', stars: { kuzu: 300, neo4j: 13000 } },
  { date: '2026-07-01', stars: { kuzu: 100 } },
  { date: '2026-08-01', stars: { kuzu: 200, neo4j: 12900 } },
];
const kuzu = { slug: 'kuzu', githubUrl: 'https://github.com/kuzudb/kuzu' };
const neo4j = { slug: 'neo4j', githubUrl: 'https://github.com/neo4j/neo4j' };
const backfill = {
  neo4j: {
    repo: 'neo4j/neo4j',
    points: [
      { date: '2024-01-01', stars: 12000, source: 'gharchive' },
      { date: '2025-01-05', stars: 12500, source: 'wayback' },
      { date: '2026-08-20', stars: 99, source: 'wayback' },
    ],
  },
};

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

test('the backfill file keeps well-formed points and lower-cases the repository', () => {
  const raw = {
    engines: {
      neo4j: {
        repo: 'Neo4j/Neo4j',
        points: [
          { date: '2024-01-01', stars: 12000, source: 'gharchive' },
          { date: '2025-01-05', stars: 12500, source: 'wayback', capture: 'https://x' },
          { date: 'Jan 2025', stars: 1, source: 'wayback' },
          { date: '2025-02-01', stars: '1', source: 'wayback' },
          { date: '2025-03-01', stars: 1, source: 'snapshot' },
        ],
      },
      empty: { repo: 'a/b', points: [{ date: 'bad' }] },
      broken: { points: [] },
    },
  };
  assert.deepEqual(parseBackfill(raw), {
    neo4j: {
      repo: 'neo4j/neo4j',
      points: [
        { date: '2024-01-01', stars: 12000, source: 'gharchive' },
        { date: '2025-01-05', stars: 12500, source: 'wayback' },
      ],
    },
  });
  assert.deepEqual(parseBackfill(null), {});
});

test('repository keys come from github.com URLs only', () => {
  assert.equal(repoKey('https://github.com/Neo4j/neo4j.git'), 'neo4j/neo4j');
  assert.equal(repoKey('https://www.github.com/kuzudb/kuzu/tree/main'), 'kuzudb/kuzu');
  assert.equal(repoKey('https://gitlab.com/a/b'), null);
  assert.equal(repoKey(undefined), null);
});

test('a series runs oldest first and ends with the live count today', () => {
  const series = starSeries({ snapshots, backfill: {} }, kuzu, 310, '2026-11-03');
  assert.deepEqual(series, [
    { date: '2026-07-01', stars: 100, source: 'snapshot' },
    { date: '2026-08-01', stars: 200, source: 'snapshot' },
    { date: '2026-09-01', stars: 300, source: 'snapshot' },
    { date: '2026-11-03', stars: 310, source: 'live' },
  ]);
});

test('backfill comes before the first snapshot, and later backfill points are ignored', () => {
  const series = starSeries({ snapshots, backfill }, neo4j, 13100, '2026-11-03');
  assert.deepEqual(
    series.map((point) => [point.date, point.stars, point.source]),
    [
      ['2024-01-01', 12000, 'gharchive'],
      ['2025-01-05', 12500, 'wayback'],
      ['2026-08-01', 12900, 'snapshot'],
      ['2026-09-01', 13000, 'snapshot'],
      ['2026-11-03', 13100, 'live'],
    ]
  );
});

test('backfill from a different repository than the catalogue links to is left out', () => {
  const moved = { slug: 'neo4j', githubUrl: 'https://github.com/someone/else' };
  assert.deepEqual(starSeries({ snapshots, backfill }, moved, 13100, '2026-11-03'), []);
});

test('the backfill alone draws a chart when there are no snapshots', () => {
  const series = starSeries({ snapshots: [], backfill }, neo4j, 13100, '2026-11-03');
  assert.equal(series.length, 4);
  assert.equal(series.at(-1).source, 'live');
});

test('snapshots dated today or later are skipped in favour of the live count', () => {
  const points = [
    { date: '2025-01-01', stars: 10, source: 'wayback' },
    { date: '2025-06-01', stars: 20, source: 'wayback' },
  ];
  const early = { kuzu: { repo: 'kuzudb/kuzu', points } };
  const series = starSeries({ snapshots, backfill: early }, kuzu, 310, '2026-08-01');
  assert.deepEqual(
    series.map(({ date, source }) => [date, source]),
    [
      ['2025-01-01', 'wayback'],
      ['2025-06-01', 'wayback'],
      ['2026-07-01', 'snapshot'],
      ['2026-08-01', 'live'],
    ]
  );
});

test('too few points, or too short a span, give no series', () => {
  assert.deepEqual(starSeries({ snapshots, backfill: {} }, neo4j, 13100, '2026-11-03'), []);
  assert.deepEqual(starSeries({ snapshots, backfill: {} }, kuzu, null, '2026-11-03'), []);
  const short = [
    { date: '2026-08-01', stars: { kuzu: 1 } },
    { date: '2026-08-15', stars: { kuzu: 2 } },
    { date: '2026-09-01', stars: { kuzu: 3 } },
  ];
  assert.deepEqual(starSeries({ snapshots: short, backfill: {} }, kuzu, 4, '2026-10-01'), []);
  assert.equal(starSeries({ snapshots: short, backfill: {} }, kuzu, 4, '2026-11-03').length, 4);
});
