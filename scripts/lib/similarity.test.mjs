import assert from 'node:assert/strict';
import test from 'node:test';
import { nearest, scorePairs } from './similarity.mjs';

function engine(slug, overrides = {}) {
  return {
    slug,
    type: 'Property Graph',
    kind: 'database',
    embeddable: false,
    implementationLanguage: 'Java',
    queryLanguages: ['openCypher'],
    protocols: ['HTTP/REST'],
    description: '',
    names: [slug],
    ...overrides,
  };
}

function score(databases, a, b) {
  const pair = scorePairs(databases).find(
    (p) => (p.source === a && p.target === b) || (p.source === b && p.target === a),
  );
  return pair.similarity;
}

/** A spread of engines so that field averages and value rarities are not degenerate. */
const background = [
  engine('rdf-store', { type: 'RDF', queryLanguages: ['SPARQL'], protocols: ['SPARQL Protocol'] }),
  engine('rust-server', { implementationLanguage: 'Rust', protocols: ['Bolt', 'HTTP/REST'] }),
  engine('cpp-embedded', { kind: 'embedded', embeddable: true, implementationLanguage: 'C++' }),
];

test('a field one engine does not record scores between a match and a mismatch', () => {
  const unrecorded = [...background, engine('a'), engine('b', { protocols: [] })];
  const matching = [...background, engine('a'), engine('b')];
  const differing = [...background, engine('a'), engine('b', { protocols: ['gRPC'] })];
  const unknown = score(unrecorded, 'a', 'b');
  assert.ok(unknown < score(matching, 'a', 'b'));
  assert.ok(unknown > score(differing, 'a', 'b'));
});

test('an engine with little metadata does not match everything perfectly', () => {
  const databases = [
    ...background,
    engine('sparse', { embeddable: null, implementationLanguage: null, protocols: [] }),
    engine('full'),
  ];
  assert.ok(score(databases, 'sparse', 'full') < 1);
});

test('sharing a rare query language counts for more than sharing a common one', () => {
  const common = Array.from({ length: 5 }, (_, i) =>
    engine(`gremlin-${i}`, { queryLanguages: ['Gremlin', `Own${i}`] }));
  const databases = [
    ...background,
    ...common,
    engine('rare-a', { queryLanguages: ['Gremlin', 'Datalog'] }),
    engine('rare-b', { queryLanguages: ['SQL', 'Datalog'] }),
  ];
  // Each pair shares exactly one of its two query languages.
  assert.ok(score(databases, 'rare-a', 'rare-b') > score(databases, 'gremlin-0', 'gremlin-1'));
});

test('engines that both run embedded score closer than an embedded engine and a server', () => {
  const databases = [
    ...background,
    engine('query-engine', { kind: 'query-engine', embeddable: true, protocols: [] }),
    engine('embedded', { kind: 'embedded', embeddable: true, protocols: [] }),
    engine('server', { kind: 'query-engine', embeddable: false }),
  ];
  assert.ok(score(databases, 'query-engine', 'embedded') > score(databases, 'embedded', 'server'));
});

test('a mismatch on a rare kind costs no more than a mismatch on a common one', () => {
  const databases = [
    ...background,
    engine('query-engine', { kind: 'query-engine' }),
    engine('library', { kind: 'library' }),
    engine('server-a'),
    engine('server-b', { kind: 'extension' }),
  ];
  const rare = score(databases, 'query-engine', 'library');
  assert.equal(rare, score(databases, 'server-a', 'server-b'));
});

test('exact ties are broken by how alike the descriptions read, not by slug', () => {
  const databases = [
    engine('subject', { description: 'columnar analytical store with vector indices' }),
    engine('aaa-unrelated', { description: 'distributed transactional cluster for banking' }),
    engine('zzz-related', { description: 'columnar analytical engine with vector search' }),
    engine('filler', { description: 'distributed columnar cluster', queryLanguages: ['SPARQL'] }),
  ];
  const [first] = nearest(scorePairs(databases), 'subject', 1);
  assert.ok([first.source, first.target].includes('zzz-related'));
});

test('a single-word engine name in a description does not make two engines read alike', () => {
  const databases = [
    engine('kuzu', { description: 'An embedded columnar database.' }),
    engine('fork-a', { description: 'Kuzu fork for analytics.' }),
    engine('fork-b', { description: 'Kuzu variant for search.' }),
    engine('plain', { description: 'Columnar search tool.' }),
  ];
  // The forks' descriptions have nothing in common except the parent's name.
  const pair = scorePairs(databases).find((p) => p.source === 'fork-a' && p.target === 'fork-b');
  assert.equal(pair.description, 0);
});

test('Cypher and openCypher count as the same query language', () => {
  const databases = [
    ...background,
    engine('opencypher', { queryLanguages: ['openCypher'] }),
    engine('cypher', { queryLanguages: ['Cypher'] }),
    engine('same', { queryLanguages: ['openCypher'] }),
  ];
  assert.equal(score(databases, 'opencypher', 'cypher'), score(databases, 'opencypher', 'same'));
});
