import assert from 'node:assert/strict';
import test from 'node:test';

const { hasBlogCharts, splitPostHtml } = await import('./blog-charts.ts');

test('a post without markers has no charts', () => {
  assert.equal(hasBlogCharts('<p>Hello</p>'), false);
});

test('splits rendered HTML at each chart marker, in order', () => {
  const html =
    '<h2>One</h2>\n<figure data-chart="ai-coauthorship-monthly"></figure>\n<p>Two</p>\n' +
    '<figure data-chart="ai-coauthorship-repos">\n</figure>';
  assert.equal(hasBlogCharts(html), true);
  assert.deepEqual(splitPostHtml(html), [
    { type: 'html', html: '<h2>One</h2>\n' },
    { type: 'chart', id: 'ai-coauthorship-monthly' },
    { type: 'html', html: '\n<p>Two</p>\n' },
    { type: 'chart', id: 'ai-coauthorship-repos' },
  ]);
});

test('an unknown chart id fails with the post and the known ids', () => {
  assert.throws(
    () => splitPostHtml('<figure data-chart="nope"></figure>', 'my-post'),
    /my-post.*"nope".*ai-coauthorship-monthly/,
  );
});

test('a figure with content is not a marker', () => {
  assert.equal(hasBlogCharts('<figure data-chart="ai-coauthorship-repos"><img></figure>'), false);
});
