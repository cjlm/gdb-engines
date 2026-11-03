/**
 * Local neighbourhoods of the generated similarity graph, for the small map on each database page.
 *
 * A neighbourhood is a set of node ids: the page's engine, the engines it links to, and any
 * engine the reader has expanded. The document drawn for it keeps every link among those nodes,
 * so peers that resemble each other are linked too.
 */

/** Ids linked to `id` in `graph`, most similar first. */
export function neighbourIds(graph, id) {
  return graph.links
    .filter((link) => link.source === id || link.target === id)
    .sort((a, b) => b.similarity - a.similarity)
    .map((link) => (link.source === id ? link.target : link.source));
}

/** A new set holding `ids`, `id` and every neighbour of `id`. */
export function expand(graph, ids, id) {
  return new Set([...ids, id, ...neighbourIds(graph, id)]);
}

/**
 * A copy of a similarity document cut down to `ids` and the links among them, with `focus` drawn
 * largest so the page's own engine stands out however far the reader expands.
 */
export function neighbourhoodDocument(source, ids, focus) {
  const document = structuredClone(source);
  const [dataset] = document.datasets;
  const graph = dataset.graph;
  graph.nodes = graph.nodes
    .filter((node) => ids.has(node.id))
    .map((node) => ({ ...node, focus: node.id === focus ? 1 : 0 }));
  graph.links = graph.links.filter((link) => ids.has(link.source) && ids.has(link.target));
  const sizeByFocus = {
    channel: 'size',
    source: { kind: 'field', id: 'focus' },
    resultType: 'num',
  };
  for (const config of [document.config, document.config.current.state]) {
    config.bindings = config.bindings.map((binding) =>
      binding.channel === 'size' ? sizeByFocus : binding);
  }
  return document;
}
