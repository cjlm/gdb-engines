import assert from 'node:assert/strict';
import test from 'node:test';

const { barHeight, hasBlogCharts, lineGeometry, parseChartSpec, slot, splitPostHtml, tipSide } = await import(
  './blog-charts.ts'
);

test('a post without markers has no charts', () => {
  assert.equal(hasBlogCharts('<p>Hello</p>'), false);
});

test('markers split the post into HTML runs and charts, in order', () => {
  const html = '<p>A</p>\n<figure data-chart="one"></figure>\n<p>B</p><figure data-chart="two-2"></figure>';
  assert.equal(hasBlogCharts(html), true);
  assert.deepEqual(
    splitPostHtml(html).map((p) => (p.type === 'chart' ? p.id : p.html.trim())),
    ['<p>A</p>', 'one', '<p>B</p>', 'two-2'],
  );
});

test('a marker id that is not a slug fails with the post id', () => {
  assert.throws(() => splitPostHtml('<figure data-chart="Bad Id"></figure>', 'my-post'), /my-post.*Bad Id/);
});

test('specs need a known version and type, an aria label and a caption', () => {
  const ok = { version: 1, type: 'bars', ariaLabel: 'a', caption: 'c', bars: [], xLabels: [] };
  assert.equal(parseChartSpec(ok, 'x').type, 'bars');
  assert.throws(() => parseChartSpec(null, 'x'), /not a JSON object/);
  assert.throws(() => parseChartSpec({ ...ok, version: 2 }, 'x'), /version 2/);
  assert.throws(() => parseChartSpec({ ...ok, type: 'pie' }, 'x'), /unknown type "pie"/);
  assert.throws(() => parseChartSpec({ ...ok, caption: '' }, 'x'), /caption/);
});

test('bars scale to the max and never go negative', () => {
  assert.equal(barHeight(5, 10), 50);
  assert.equal(barHeight(-1, 10), 0);
  assert.equal(barHeight(3, 0), 0);
});

test('slots are evenly spaced with a gap', () => {
  assert.deepEqual(slot(0, 10), { left: 1.5, width: 7 });
  assert.deepEqual(slot(9, 10), { left: 91.5, width: 7 });
});

test('line points span the width and clamp to the y range', () => {
  const g = lineGeometry([0, 30, 12.5], 25);
  assert.deepEqual(g.points, [{ x: 0, y: 100 }, { x: 50, y: 0 }, { x: 100, y: 50 }]);
  assert.match(g.line, /^M/);
  assert.match(g.area, /^M/);
  assert.deepEqual(lineGeometry([7], 25).points, [{ x: 0, y: 72 }]);
});

test('tooltips flip near the edges', () => {
  assert.equal(tipSide(5), 'top-right');
  assert.equal(tipSide(50), 'top');
  assert.equal(tipSide(95), 'top-left');
});
