import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsupportedValues } from './per-value-evidence.mjs';

const source = (supports, verified = 'unchecked') => ({ url: 'https://example.com', quote: 'q', supports, verified });

test('every value backed by its own source passes', () => {
  const claim = { value: ['SPARQL 1.1', 'SHACL validation'], sources: [source('SPARQL 1.1'), source('SHACL validation')] };
  assert.deepEqual(unsupportedValues(claim), []);
});

test('a source for one value does not back another', () => {
  const claim = { value: ['SPARQL 1.1', 'OWL reasoning'], sources: [source('SPARQL 1.1')] };
  assert.deepEqual(unsupportedValues(claim), ['OWL reasoning']);
});

test('a source without supports backs nothing', () => {
  const claim = { value: ['semantic'], sources: [{ url: 'https://example.com', quote: 'q' }] };
  assert.deepEqual(unsupportedValues(claim), ['semantic']);
});

test('publishedOnly ignores quotes that failed or are unchecked', () => {
  const claim = {
    value: ['SPARQL 1.1', 'RDFS reasoning', 'Vector search'],
    sources: [source('SPARQL 1.1', 'matched'), source('RDFS reasoning', 'mismatch'), source('Vector search', 'matched-archive')],
  };
  assert.deepEqual(unsupportedValues(claim, { publishedOnly: true }), ['RDFS reasoning']);
});

test('an empty value or missing sources is handled', () => {
  assert.deepEqual(unsupportedValues({ value: [] }), []);
  assert.deepEqual(unsupportedValues({ value: ['virtual'] }), ['virtual']);
});
