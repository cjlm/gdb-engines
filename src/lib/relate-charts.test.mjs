import assert from 'node:assert/strict';
import test from 'node:test';

const {
  AUDIENCE_CHART,
  ONTOLOGY_CHART,
  PERIODS,
  adrBars,
  aiCounts,
  dayX,
  dotDiameter,
  maxRate,
  periodOf,
  poolByHalfYear,
} = await import('./relate-charts.ts');

const talk = (d, w, counts) => ({
  id: d, d, t: d, k: 'keynote', solo: true, w,
  ont: 0, sem: 0, kg: 0, rag: 0, ctx: 0, dev: 0, ent: 0, stu: 0,
  ...counts,
});

test('half-years run from 2017 H1 to 2026 H2', () => {
  assert.equal(PERIODS.length, 20);
  assert.equal(PERIODS[0], '2017 H1');
  assert.equal(PERIODS.at(-1), '2026 H2');
  assert.equal(periodOf('2024-06-30'), '2024 H1');
  assert.equal(periodOf('2024-07-01'), '2024 H2');
});

test('rates pool mentions over words, so short clips count by length', () => {
  const talks = [talk('2026-03-01', 9_000, { ont: 9 }), talk('2026-04-01', 1_000, { ont: 11 })];
  const pooled = poolByHalfYear(talks, ONTOLOGY_CHART.series);
  const period = pooled.find((p) => p.period === '2026 H1');
  assert.equal(period.words, 10_000);
  assert.equal(period.rates.ont, 2);
});

test('periods without talks are blank, not zero', () => {
  const pooled = poolByHalfYear([talk('2026-03-01', 1_000, { ont: 1 })], ONTOLOGY_CHART.series);
  assert.equal(pooled.find((p) => p.period === '2020 H1').rates.ont, null);
});

test('a talk missing a count leaves every row of that chart', () => {
  const talks = [talk('2025-02-01', 1_000, { dev: 5 }), talk('2025-03-01', 1_000, { dev: 1, stu: null })];
  const period = poolByHalfYear(talks, AUDIENCE_CHART.series).find((p) => p.period === '2025 H1');
  assert.equal(period.talks.length, 1);
  assert.equal(period.rates.dev, 5);
});

test('one scale spans every row', () => {
  const talks = [talk('2026-03-01', 1_000, { ont: 7, kg: 3 })];
  assert.equal(maxRate(poolByHalfYear(talks, ONTOLOGY_CHART.series), ONTOLOGY_CHART.series), 7);
});

test('dots sit by day and grow with lines added', () => {
  assert.equal(dayX(0), 0);
  assert.equal(dayX(5.5), 50);
  assert.equal(dayX(20), 100);
  assert.ok(dotDiameter(10) < dotDiameter(100) && dotDiameter(100) < dotDiameter(1_000));
  assert.equal(dotDiameter(1_000_000), 22);
});

test('AI counts include trailers lost in the squash and count bots in the total', () => {
  const commit = (ai) => ({ day: 0, lines: 1, files: 1, ai, time: '', author: '' });
  assert.deepEqual(aiCounts(['main', 'branch', 'none', 'bot'].map(commit)), { commits: 4, ai: 2, aiPct: 50 });
  assert.deepEqual(aiCounts([]), { commits: 0, ai: 0, aiPct: 0 });
});

test('ADR bars keep a running total on one scale', () => {
  const bars = adrBars([{ date: '2026-11-06', added: 475 }, { date: '2026-11-07', added: 3 }]);
  assert.deepEqual(bars.map((b) => b.total), [475, 478]);
  assert.equal(bars[0].height, 100);
  assert.equal(bars[1].height, 0.63);
});
