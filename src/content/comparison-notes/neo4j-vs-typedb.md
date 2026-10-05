---
reviewed: '2026-10-05'
sources:
  - { title: "TypeDB documentation", url: "https://typedb.com/docs/home/" }
  - { title: "Wikipedia: TypeDB", url: "https://en.wikipedia.org/wiki/TypeDB" }
  - { title: "Neo4j Operations Manual: editions", url: "https://neo4j.com/docs/operations-manual/current/introduction/" }
---
TypeDB models data as entities, relations and attributes arranged in type hierarchies, and queries it with TypeQL, including functions for derived data. A query against a supertype also returns its subtypes. Version 3.0, released in December 2024, rewrote the database in Rust; it is licensed under MPL-2.0. Pick TypeDB when the domain has a rich schema with inheritance and you want the database to enforce and reason over it.

Neo4j is a property graph database queried with Cypher and GQL, with a wider set of drivers, tools and graph algorithms. Pick it for traversal-heavy application queries over a flexible schema.
