/**
 * The graph page's views, in switcher order. Adding a view means adding an entry here and a
 * component in src/components/graph/ that renders `data-graph-view="<id>"` and registers a
 * controller (see src/components/graph/view-registry.ts).
 *
 * `shortLabel`, when set, replaces `label` on narrow screens and the full label becomes the
 * link's accessible name. `document` names the Garphield document a frame view draws.
 */
export const GRAPH_VIEWS = [
  {
    id: 'query-languages',
    label: 'Query languages',
    shortLabel: 'Languages',
    title: 'Graph database query language map — GDB-Engines',
    description: 'Explore graph databases through the query languages they support.',
    modelDescription: 'Databases linked via query languages supported.',
    mobileDescription: 'Databases linked via query languages supported.',
    document: '/graphs/databases-languages.gfd',
  },
  {
    id: 'similarity',
    label: 'Similarity',
    title: 'Graph database similarity map — GDB-Engines',
    description: 'Explore graph databases linked to their nearest catalogue peers.',
    modelDescription:
      'Link each database to its four nearest catalog peers by data model, kind, whether it ' +
      'runs embedded, implementation language, query languages and protocols, with rarer ' +
      'shared traits counting for more, and every fork to its parent.',
    mobileDescription: 'Databases linked to their nearest catalog peers.',
    document: '/graphs/databases-similarity.gfd',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    title: 'Graph database product timeline — GDB-Engines',
    description:
      'Explore when products in the graph database catalogue were first publicly released.',
    modelDescription:
      'See when each catalogued database product was first released. ' +
      'Some added graph capabilities later.',
    mobileDescription:
      'A timeline of graph database product releases, from the newest products back to the ' +
      'earliest.',
  },
  {
    id: 'lineage',
    label: 'Lineage',
    title: 'Graph database lineage: forks, renames and successors — GDB-Engines',
    description:
      'Explore where graph databases came from: forks, rebrands and successors, each backed ' +
      'by a cited source.',
    modelDescription: 'Where each engine came from: forks, derivatives and former names.',
    mobileDescription: 'Forks, renames and successors of graph databases.',
  },
];

export const DEFAULT_GRAPH_VIEW = GRAPH_VIEWS[0].id;

/** The view with this id. Throws for an id that is not in GRAPH_VIEWS. */
export function graphView(id) {
  const view = GRAPH_VIEWS.find((candidate) => candidate.id === id);
  if (!view) {
    const known = GRAPH_VIEWS.map((candidate) => candidate.id).join(', ');
    throw new Error(`Unknown graph view "${id}". Known views: ${known}.`);
  }
  return view;
}

/** The site path that renders a view directly. */
export function graphViewPath(id) {
  return `/graph/${id}/`;
}

/** The canonical URL of a view's page. */
export function graphViewCanonical(id) {
  return `https://gdb-engines.com${graphViewPath(id)}`;
}

/** The meta description of a view's page. */
export function graphViewPageDescription(view, databaseCount) {
  return `${view.description} Compare ${databaseCount} graph databases.`;
}

/** The view a path shows, falling back to the default view for /graph/ and unknown paths. */
export function graphViewIdForPath(pathname) {
  const view = GRAPH_VIEWS.find((candidate) => graphViewPath(candidate.id) === pathname);
  return view?.id ?? DEFAULT_GRAPH_VIEW;
}
