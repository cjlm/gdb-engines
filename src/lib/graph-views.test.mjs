import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_GRAPH_VIEW,
  GRAPH_VIEWS,
  graphView,
  graphViewCanonical,
  graphViewIdForPath,
  graphViewPageDescription,
  graphViewPath,
} from './graph-views.mjs';

test('views keep their published order and URLs', () => {
  assert.deepEqual(
    GRAPH_VIEWS.map((view) => graphViewPath(view.id)),
    ['/graph/query-languages/', '/graph/similarity/', '/graph/timeline/', '/graph/lineage/'],
  );
  assert.equal(DEFAULT_GRAPH_VIEW, 'query-languages');
  assert.equal(graphViewCanonical('lineage'), 'https://gdb-engines.com/graph/lineage/');
});

test('every view has unique id and the copy the page and switcher need', () => {
  assert.equal(new Set(GRAPH_VIEWS.map((view) => view.id)).size, GRAPH_VIEWS.length);
  for (const view of GRAPH_VIEWS) {
    const fields = ['label', 'title', 'description', 'modelDescription', 'mobileDescription'];
    for (const field of fields) {
      assert.equal(typeof view[field], 'string', `${view.id}.${field}`);
      assert.ok(view[field].length > 0, `${view.id}.${field}`);
    }
    assert.match(view.title, / — GDB-Engines$/);
  }
});

test('only the Garphield views name a document, and those documents exist', async () => {
  const { existsSync } = await import('node:fs');
  const documents = GRAPH_VIEWS.filter((view) => view.document).map((view) => view.id);
  assert.deepEqual(documents, ['query-languages', 'similarity']);
  for (const view of GRAPH_VIEWS.filter((candidate) => candidate.document)) {
    assert.ok(existsSync(`public${view.document}`), view.document);
  }
});

test('looks up a view by id and names the known ids when it cannot', () => {
  assert.equal(graphView('timeline').label, 'Timeline');
  assert.throws(() => graphView('rankings-typo'), /Unknown graph view "rankings-typo".*lineage/);
});

test('page description appends the database count', () => {
  assert.equal(
    graphViewPageDescription(graphView('query-languages'), 12),
    'Explore graph databases through the query languages they support. ' +
      'Compare 12 graph databases.',
  );
});

test('resolves a path to its view and falls back to the default', () => {
  assert.equal(graphViewIdForPath('/graph/similarity/'), 'similarity');
  assert.equal(graphViewIdForPath('/graph/lineage/'), 'lineage');
  assert.equal(graphViewIdForPath('/graph/'), 'query-languages');
  assert.equal(graphViewIdForPath('/graph/similarity'), 'query-languages');
  assert.equal(graphViewIdForPath('/graph/unknown/'), 'query-languages');
});
