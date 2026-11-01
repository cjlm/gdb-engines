import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageText } from './page-text.mjs';

const words = (html) => pageText(html).replace(/\s+/g, ' ').trim();

test('drops script, style and svg blocks with their contents', () => {
  assert.equal(words('<p>Kept</p><script>var x = 1;</script><style>p{}</style><svg><text>chart</text></svg>'), 'Kept');
});

test('a self-closing svg does not swallow the text after it', () => {
  const html = '<svg class="edges" aria-hidden="true"/><h3><span>The</span> <span>knowledge</span> <span>graph</span></h3><svg><path/></svg>';
  assert.equal(words(html), 'The knowledge graph');
});

test('drops comments and tags but keeps their text', () => {
  assert.equal(words('<!-- hidden --><a href="/x">Linked</a> text'), 'Linked text');
});
