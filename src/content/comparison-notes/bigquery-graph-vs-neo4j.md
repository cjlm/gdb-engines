---
reviewed: '2026-10-05'
sources:
  - { title: "Google Cloud blog: Introducing BigQuery Graph", url: "https://cloud.google.com/blog/products/data-analytics/introducing-bigquery-graph" }
  - { title: "Neo4j Operations Manual: editions", url: "https://neo4j.com/docs/operations-manual/current/introduction/" }
---
BigQuery Graph has been in preview since April 2026, so features and pricing can still change. It defines a property graph over existing BigQuery tables with `CREATE PROPERTY GRAPH` and queries it with GQL on BigQuery's serverless engine. Google positions it for analysis over warehouse data, such as fraud detection and customer 360, and pairs it with Spanner Graph for real-time queries. Pick it when the data already sits in BigQuery and the questions are analytical.

Neo4j is a transactional graph database that applications read and write continuously, and it runs outside Google Cloud. Community Edition is GPLv3; clustering and role-based access control need Enterprise Edition. Pick it when the graph backs an application rather than a report.
