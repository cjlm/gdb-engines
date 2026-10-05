---
reviewed: '2026-10-05'
sources:
  - { title: "PuppyGraph documentation", url: "https://docs.puppygraph.com/" }
  - { title: "Neo4j Operations Manual: editions", url: "https://neo4j.com/docs/operations-manual/current/introduction/" }
---
PuppyGraph stores no data. It connects to existing databases, warehouses and lakes, including PostgreSQL, MySQL, Snowflake, BigQuery and Databricks, and runs openCypher or Gremlin queries over those tables in place, so no ETL pipeline is needed. It is proprietary software. Pick it when the data already lives in a warehouse or lake and you want to query it as a graph without copying it.

Neo4j stores the graph itself and handles transactional reads and writes. Pick it when the graph is the system of record for an application.
