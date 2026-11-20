import assert from 'node:assert/strict';
import test from 'node:test';

const { hasBlogCharts, parseChartSpec, splitPostHtml } = await import(
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
  const ok = { version: 1, type: 'echarts', ariaLabel: 'a', caption: 'c', height: 300, option: {} };
  assert.equal(parseChartSpec(ok, 'x').type, 'echarts');
  assert.throws(() => parseChartSpec(null, 'x'), /not a JSON object/);
  assert.throws(() => parseChartSpec({ ...ok, version: 2 }, 'x'), /version 2/);
  assert.throws(() => parseChartSpec({ ...ok, type: 'pie' }, 'x'), /unknown type "pie"/);
  assert.throws(() => parseChartSpec({ ...ok, caption: '' }, 'x'), /caption/);
  assert.throws(() => parseChartSpec({ ...ok, option: null }, 'x'), /no ECharts option/);
});

test('embeds are limited to pages of this site', () => {
  const embed = { version: 1, type: 'embed', ariaLabel: 'a', caption: 'c', height: 500 };
  assert.equal(parseChartSpec({ ...embed, src: '/graph/timeline/' }, 'x').type, 'embed');
  assert.throws(() => parseChartSpec({ ...embed, src: 'https://example.com/' }, 'x'), /only pages of this site/);
  assert.throws(() => parseChartSpec({ ...embed, src: '//example.com/' }, 'x'), /only pages of this site/);
});
