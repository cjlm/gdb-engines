import assert from 'node:assert/strict';
import test from 'node:test';

const { CHART_WIDTH, niceStep, starChart } = await import('./star-chart.ts');

const point = (date, stars) => ({ date, stars, source: 'wayback' });

test('gridline steps are 1, 2 or 5 times a power of ten', () => {
  assert.equal(niceStep(17000), 10000);
  assert.equal(niceStep(12000), 5000);
  assert.equal(niceStep(4019), 2000);
  assert.equal(niceStep(250), 100);
  assert.equal(niceStep(2), 1);
  assert.equal(niceStep(0), 1);
});

test('the y axis starts at zero and tops out at the first step above the highest count', () => {
  const chart = starChart([point('2024-01-01', 1000), point('2026-01-01', 4019)]);
  assert.deepEqual(
    chart.yTicks.map((tick) => [tick.value, tick.offset]),
    [
      [0, 100],
      [2000, 66.67],
      [4000, 33.33],
      [6000, 0],
    ]
  );
});

test('the line runs edge to edge and ends at the latest count', () => {
  const chart = starChart([
    point('2024-01-01', 0),
    point('2025-01-01', 50),
    point('2026-01-01', 100),
  ]);
  assert.match(chart.line, /^M0,120/);
  assert.match(chart.line, new RegExp(`${CHART_WIDTH},0$`));
  assert.deepEqual(chart.end, { x: 100, y: 0 });
  assert.match(chart.area, /^M0,120/);
  assert.match(chart.area, /L600,120.*Z$/);
});

test('year labels mark each January inside the span, away from the ends', () => {
  const chart = starChart([point('2022-01-01', 10), point('2026-01-01', 20)]);
  assert.deepEqual(
    chart.xTicks.map((tick) => tick.value),
    [2023, 2024, 2025]
  );
  assert.equal(chart.xTicks[1].offset, 49.97);
});

test('long spans thin the year labels out', () => {
  const chart = starChart([point('2012-06-01', 10), point('2026-06-01', 20)]);
  assert.ok(chart.xTicks.length <= 5);
  assert.deepEqual(chart.xTicks.map((tick) => tick.value), [2016, 2019, 2022]);
});

test('the end marker sits at the latest count, not the highest', () => {
  const chart = starChart([
    point('2024-01-01', 0),
    point('2025-01-01', 100),
    point('2026-01-01', 80),
  ]);
  assert.deepEqual(chart.end, { x: 100, y: 20 });
});

test('a span inside one year has no year labels', () => {
  const chart = starChart([point('2026-02-01', 10), point('2026-11-01', 20)]);
  assert.deepEqual(chart.xTicks, []);
});
