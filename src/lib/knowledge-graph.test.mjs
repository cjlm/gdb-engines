import assert from 'node:assert/strict';
import test from 'node:test';

const { kgKindsOf } = await import('./knowledge-graph.ts');

test('an engine that answers SPARQL itself is semantic, listed first', () => {
  const db = { kg_kinds: ['virtual'], kg_capabilities: ['SHACL validation', 'SPARQL 1.1'] };
  assert.deepEqual(kgKindsOf(db), ['semantic', 'virtual']);
});

test('SPARQL from an extension does not make an engine semantic', () => {
  const db = { kg_kinds: ['property-graph'], kg_extension_capabilities: ['SPARQL 1.1'] };
  assert.deepEqual(kgKindsOf(db), ['property-graph']);
});

test('presented kinds keep display order, and no fields means no kinds', () => {
  assert.deepEqual(kgKindsOf({ kg_kinds: ['virtual', 'property-graph'] }), [
    'property-graph',
    'virtual',
  ]);
  assert.deepEqual(kgKindsOf({}), []);
});
