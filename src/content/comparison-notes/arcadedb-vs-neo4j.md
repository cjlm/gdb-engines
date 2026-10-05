---
reviewed: '2026-10-05'
sources:
  - { title: "ArcadeDB README", url: "https://github.com/ArcadeData/arcadedb" }
  - { title: "Neo4j Operations Manual: editions", url: "https://neo4j.com/docs/operations-manual/current/introduction/" }
---
ArcadeDB accepts Cypher and speaks Neo4j's Bolt protocol, so Neo4j drivers can connect to it; check your own queries, since ArcadeDB describes itself as Cypher-compatible rather than identical. Everything ships under Apache-2.0, including Raft-based high availability, and the same database also stores documents, key/value pairs, time series and vectors. Pick ArcadeDB for clustering without a commercial licence, or to mix data models.

Neo4j's Community Edition is GPLv3. Clustering, multiple databases, role-based access control and online backup need Enterprise Edition. Pick Neo4j for its graph algorithms library and tooling.
