/**
 * Knowledge graph vocabularies for the catalogue.
 *
 * "Knowledge graph" names several different things. `kg_kinds` records which of them an engine's
 * own makers present it for, so the knowledge graph ranking can separate a semantic RDF store from
 * a property graph database that markets the term. The AI senses (GraphRAG, agent memory) are
 * already covered by `ai_roles`.
 *
 * `kg_capabilities` records the engine-level parts of a semantic knowledge graph stack, following
 * the enterprise knowledge graph architecture in Jessica Talisman's *Ontology Pipeline*: a triple
 * store queried with SPARQL 1.1, a reasoner, SHACL validation, R2RML virtualisation, vector
 * retrieval and graph algorithms. Only built-in or officially shipped capabilities count, never a
 * third-party plugin.
 *
 * Both are closed vocabularies enforced by the content schema, and every value needs a source
 * whose `supports` names it (scripts/check-evidence.mjs).
 */

export const KG_KINDS = ['semantic', 'property-graph', 'virtual'] as const;
export type KgKind = (typeof KG_KINDS)[number];

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
  'Graph algorithms': 'Ships a library of graph analytics such as PageRank, community detection and paths.',
};
