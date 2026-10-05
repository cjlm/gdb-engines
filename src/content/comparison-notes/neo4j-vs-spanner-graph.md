---
reviewed: '2026-10-05'
sources:
  - { title: "Neo4j Operations Manual: editions", url: "https://neo4j.com/docs/operations-manual/current/introduction/" }
  - { title: "Spanner Graph overview", url: "https://docs.cloud.google.com/spanner/docs/graph/overview" }
---
Spanner Graph maps existing Spanner tables to a property graph without moving data, and queries it with ISO GQL alongside SQL in the same database. It inherits Spanner's scaling and consistency, adds vector and full-text search to graph queries, and requires the Spanner Enterprise or Enterprise Plus edition on Google Cloud. Pick it when the graph is one view over relational data you already keep in Spanner.

Neo4j is a separate graph database that runs anywhere, queried with Cypher and GQL. Community Edition is GPLv3; clustering, multiple databases, role-based access control and online backup need Enterprise Edition. Pick it when the graph is the primary data model and you want Neo4j's tooling outside Google Cloud.
