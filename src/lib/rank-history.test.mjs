import assert from 'node:assert/strict';
import test from 'node:test';

const { methodologyVersions, monthlySnapshots, parseRanking, rankOf, rankSeries } = await import(
  './rank-history.ts'
);

const snapshot = (date, slugs, methodologyVersion = '10') => ({
  date,
  methodologyVersion,
  engines: slugs.map((slug) => ({ slug, name: slug.toUpperCase() })),
});

test('a ranking file keeps engines in order and drops malformed ones', () => {
  const raw = {
    methodologyVersion: 7,
    overall: [
      { slug: 'neo4j', name: 'Neo4j', score: 90 },
      { slug: 'nameless' },
      null,
      { slug: 'kuzu', name: 'Kùzu' },
    ],
  };
  assert.deepEqual(parseRanking('2026-07-01', raw), {
    date: '2026-07-01',
    methodologyVersion: '7',
    engines: [
      { slug: 'neo4j', name: 'Neo4j' },
      { slug: 'kuzu', name: 'Kùzu' },
    ],
  });
  assert.deepEqual(parseRanking('2026-07-01', null).engines, []);
  assert.equal(parseRanking('2026-07-01', {}).methodologyVersion, 'unknown');
});

test('each calendar month is represented by its last run, oldest month first', () => {
  const months = monthlySnapshots([
    snapshot('2026-06-02', ['a']),
    snapshot('2026-05-29', ['b']),
    snapshot('2026-05-28', ['c']),
    snapshot('2026-05-30', ['d']),
    snapshot('2026-07-01', ['e']),
  ]);
  assert.deepEqual(
    months.map((month) => month.date),
    ['2026-05-30', '2026-06-02', '2026-07-01']
  );
  assert.deepEqual(monthlySnapshots([]), []);
});

test('rank is 1-based and null for engines missing from a run', () => {
  const run = snapshot('2026-07-01', ['neo4j', 'kuzu']);
  assert.equal(rankOf(run, 'neo4j'), 1);
  assert.equal(rankOf(run, 'kuzu'), 2);
  assert.equal(rankOf(run, 'dgraph'), null);
});

test('methodology versions are listed once each, in order', () => {
  const months = [
    snapshot('2026-05-01', [], '5'),
    snapshot('2026-06-01', [], '7'),
    snapshot('2026-07-01', [], '7'),
  ];
  assert.deepEqual(methodologyVersions(months), ['5', '7']);
});

test('series cover every engine in the top N in any month, current top N first', () => {
  const months = [
    snapshot('2026-05-01', ['a', 'b', 'c', 'd']),
    snapshot('2026-06-01', ['b', 'a', 'd', 'c']),
    snapshot('2026-07-01', ['d', 'a', 'c']),
  ];
  const series = rankSeries(months, 2);
  assert.deepEqual(
    series.map((entry) => entry.slug),
    ['d', 'a', 'b']
  );
  const [entering, staying, leaving] = series;
  assert.deepEqual(
    entering.points.map((point) => point.rank),
    [4, 3, 1]
  );
  assert.equal(entering.inCurrentTop, true);
  assert.equal(staying.current, 2);
  assert.deepEqual(leaving.points, [
    { month: '2026-05', rank: 2 },
    { month: '2026-06', rank: 1 },
    { month: '2026-07', rank: null },
  ]);
  assert.equal(leaving.current, null);
  assert.equal(leaving.inCurrentTop, false);
});

test('engines that dropped out are ordered by their best rank', () => {
  const months = [
    snapshot('2026-05-01', ['p', 'q', 'z', 'w']),
    snapshot('2026-06-01', ['w', 'q', 'z', 'p']),
    snapshot('2026-07-01', ['z', 'n', 'p', 'q', 'w']),
  ];
  assert.deepEqual(
    rankSeries(months, 2).map((entry) => [entry.slug, entry.inCurrentTop]),
    [
      ['z', true],
      ['n', true],
      ['p', false],
      ['w', false],
      ['q', false],
    ]
  );
});

test('no months means no series', () => {
  assert.deepEqual(rankSeries([], 10), []);
});
