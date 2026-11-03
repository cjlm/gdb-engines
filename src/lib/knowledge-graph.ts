/**
 * Knowledge graph vocabularies for the catalogue.
 *
 * "Knowledge graph" names several different things. An engine is a semantic knowledge graph by
 * what it does: it answers SPARQL 1.1 itself, so it stores RDF and can carry an ontology as data.
 * The other kinds are about how an engine is offered, so `kg_kinds` records them only where the
 * engine's own makers present it that way: a property graph database for knowledge graphs, or a
 * layer that builds one over data left where it is. The AI senses (GraphRAG, agent memory) are
 * already covered by `ai_roles`.
 *
 * `kg_capabilities` records the engine-level parts of a semantic knowledge graph stack, following
 * the enterprise knowledge graph architecture in Jessica Talisman's *Ontology Pipeline*: a triple
 * store queried with SPARQL 1.1, a reasoner, SHACL validation, R2RML virtualisation, vector
 * retrieval and graph algorithms. `kg_capabilities` counts only what the engine ships;
 * `kg_extension_capabilities` counts what an extension from the same makers adds, such as Neo4j
 * Labs' neosemantics. Third-party plugins count in neither.
 *
 * All three are closed vocabularies enforced by the content schema, and every value needs a
 * verified source whose `supports` names it (scripts/check-evidence.mjs).
 */

/** Kinds recorded in `kg_kinds`: how the makers present the engine. */
export const KG_KINDS = ['property-graph', 'virtual'] as const;
export type KgKind = 'semantic' | (typeof KG_KINDS)[number];
/** Every kind, in display order. */
export const ALL_KG_KINDS: readonly KgKind[] = ['semantic', ...KG_KINDS];

export const kgKindLabels: Record<KgKind, string> = {
  semantic: 'Semantic (ontology-based)',
  'property-graph': 'Property graph',
  virtual: 'Virtual (over existing data)',
};

export const KG_CAPABILITIES = [
  'SPARQL 1.1',
  'RDFS reasoning',
  'OWL reasoning',
  'SHACL validation',
  'R2RML mapping',
  'Vector search',
  'Graph algorithms',
] as const;
export type KgCapability = (typeof KG_CAPABILITIES)[number];

export const kgCapabilityDescriptions: Record<KgCapability, string> = {
  'SPARQL 1.1': 'Answers SPARQL 1.1 queries, the W3C standard query language for RDF.',
  'RDFS reasoning': 'Infers facts from RDF Schema: subclasses, subproperties, domains and ranges.',
  'OWL reasoning': 'Infers facts from an OWL ontology, in at least one OWL profile.',
  'SHACL validation': 'Checks data against SHACL shapes, the W3C standard for RDF constraints.',
  'R2RML mapping': 'Maps relational or other source data into RDF with R2RML or RML.',
  'Vector search': 'Has its own vector similarity index alongside the graph.',
  'Graph algorithms':
    'Ships a library of graph analytics such as PageRank, community detection and paths.',
};

interface KgFields {
  kg_kinds?: readonly string[];
  kg_capabilities?: readonly string[];
}

/** The knowledge graph kinds an engine belongs to, semantic first. */
export function kgKindsOf(db: KgFields): KgKind[] {
  const semantic = db.kg_capabilities?.includes('SPARQL 1.1') ? (['semantic'] as const) : [];
  return [...semantic, ...KG_KINDS.filter((kind) => db.kg_kinds?.includes(kind))];
}
