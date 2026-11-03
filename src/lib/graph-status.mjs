function countDatabases(graph) {
  return graph.nodes.filter((node) => String(node.id).startsWith('db:')).length;
}

/** Links whose similarity score meets the threshold. Links without a score never count. */
export function countSimilarLinks(graph, threshold) {
  return graph.links.filter(
    (link) => typeof link.similarity === 'number' && link.similarity >= threshold,
  ).length;
}

/** Status line for the query-language graph: databases, languages and pairings. */
export function queryLanguageStatus(graph) {
  const databases = countDatabases(graph);
  const languages = graph.nodes.length - databases;
  return (
    `${databases} databases · ${languages} query languages · ` +
    `${graph.links.length} supported database–language pairings`
  );
}

/** Status line for the similarity graph at a minimum similarity threshold. */
export function similarityStatus(graph, threshold) {
  const pairs = countSimilarLinks(graph, threshold);
  return `${countDatabases(graph)} databases · ${pairs} similar database pairs`;
}

/** Label for the similarity threshold slider, as a rounded percentage. */
export function similarityThresholdLabel(value) {
  return `≥ ${Math.round(Number(value) * 100)}%`;
}
