import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countSimilarLinks,
  queryLanguageStatus,
  similarityStatus,
  similarityThresholdLabel,
} from './graph-status.mjs';

const languageGraph = {
  nodes: [{ id: 'db:neo4j' }, { id: 'db:memgraph' }, { id: 'lang:cypher' }, { id: 'dbql' }],
  links: [
    { source: 'db:neo4j', target: 'lang:cypher' },
    { source: 'db:memgraph', target: 'lang:cypher' },
  ],
};

const similarityGraph = {
  nodes: [{ id: 'db:a' }, { id: 'db:b' }, { id: 'db:c' }],
  links: [
    { source: 'db:a', target: 'db:b', similarity: 0.2 },
    { source: 'db:b', target: 'db:c', similarity: 0.5 },
    { source: 'db:a', target: 'db:c', similarity: 0.8 },
    { source: 'db:c', target: 'db:a', kind: 'fork' },
    { source: 'db:c', target: 'db:b', similarity: null },
    { source: 'db:b', target: 'db:a', similarity: '0.9' },
  ],
};

test('query-language status counts databases, languages and pairings', () => {
  assert.equal(
    queryLanguageStatus(languageGraph),
    '2 databases · 2 query languages · 2 supported database–language pairings',
  );
});

test('an empty graph reports zero everywhere', () => {
  assert.equal(
    queryLanguageStatus({ nodes: [], links: [] }),
    '0 databases · 0 query languages · 0 supported database–language pairings',
  );
  assert.equal(
    similarityStatus({ nodes: [], links: [] }, 0.2),
    '0 databases · 0 similar database pairs',
  );
});

test('similar links include the threshold itself and skip unscored links', () => {
  assert.equal(countSimilarLinks(similarityGraph, 0.2), 3);
  assert.equal(countSimilarLinks(similarityGraph, 0.5), 2);
  assert.equal(countSimilarLinks(similarityGraph, 0.51), 1);
  assert.equal(countSimilarLinks(similarityGraph, 0.81), 0);
  assert.equal(countSimilarLinks(similarityGraph, 0), 3);
});

test('similarity status reports the pairs left at the threshold', () => {
  assert.equal(similarityStatus(similarityGraph, 0.5), '3 databases · 2 similar database pairs');
});

test('threshold label rounds to a whole percentage', () => {
  assert.equal(similarityThresholdLabel('0.2'), '≥ 20%');
  assert.equal(similarityThresholdLabel(0.35), '≥ 35%');
  assert.equal(similarityThresholdLabel('0.554'), '≥ 55%');
  assert.equal(similarityThresholdLabel('0.555'), '≥ 56%');
});
