import assert from 'node:assert/strict';
import test from 'node:test';
import { expand, neighbourhoodDocument, neighbourIds } from './similarity-neighbourhood.mjs';

const link = (source, target, similarity) => ({ source, target, similarity });

/** a links to b and c; b and c resemble each other; d hangs off c only. */
const graph = {
  nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id })),
  links: [link('a', 'b', 0.5), link('c', 'a', 0.9), link('b', 'c', 0.7), link('c', 'd', 0.6)],
};

function document() {
  const bindings = [
    { channel: 'size', source: { kind: 'algorithm', id: 'degree' }, resultType: 'num' },
    { channel: 'color', source: { kind: 'field', id: 'type' }, resultType: 'cat' },
  ];
  return {
    datasets: [{ graph: structuredClone(graph) }],
    config: { bindings, current: { state: { bindings } } },
  };
}

test('neighbours come from links in either direction, most similar first', () => {
  assert.deepEqual(neighbourIds(graph, 'a'), ['c', 'b']);
});

test('expanding adds the node and its neighbours without dropping what was shown', () => {
  const shown = expand(graph, new Set(['a']), 'a');
  assert.deepEqual([...expand(graph, shown, 'd')].sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual([...shown].sort(), ['a', 'b', 'c']);
});

test('the neighbourhood keeps links between peers and drops links leaving it', () => {
  const cut = neighbourhoodDocument(document(), expand(graph, new Set(), 'a'), 'a');
  const pairs = cut.datasets[0].graph.links.map((l) => `${l.source}-${l.target}`).sort();
  assert.deepEqual(pairs, ['a-b', 'b-c', 'c-a']);
  assert.deepEqual(cut.datasets[0].graph.nodes.map((n) => n.id).sort(), ['a', 'b', 'c']);
});

test('the focus engine is sized above its peers in the saved view too', () => {
  const cut = neighbourhoodDocument(document(), new Set(['a', 'b']), 'a');
  const focus = Object.fromEntries(cut.datasets[0].graph.nodes.map((n) => [n.id, n.focus]));
  assert.deepEqual(focus, { a: 1, b: 0 });
  for (const bindings of [cut.config.bindings, cut.config.current.state.bindings]) {
    const size = bindings.find((b) => b.channel === 'size');
    assert.deepEqual(size.source, { kind: 'field', id: 'focus' });
    assert.ok(bindings.some((b) => b.channel === 'color'));
  }
});

test('cutting a neighbourhood leaves the full document untouched', () => {
  const full = document();
  neighbourhoodDocument(full, new Set(['a']), 'a');
  assert.equal(full.datasets[0].graph.nodes.length, 4);
  assert.equal(full.config.bindings[0].source.id, 'degree');
});
