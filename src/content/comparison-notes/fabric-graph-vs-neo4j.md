---
reviewed: '2026-10-05'
sources:
  - { title: "What is graph in Microsoft Fabric?", url: "https://learn.microsoft.com/en-us/fabric/graph/overview" }
  - { title: "How graph in Microsoft Fabric works", url: "https://learn.microsoft.com/en-us/fabric/graph/how-graph-works" }
  - { title: "Neo4j Operations Manual: editions", url: "https://neo4j.com/docs/operations-manual/current/introduction/" }
---
Graph in Microsoft Fabric builds a labeled property graph from tables in OneLake, which you load and refresh from those tables, and queries it with GQL or natural language. It bills against existing Fabric capacity with no separate licence, provisions at least 100 GB of graph storage, and falls under OneLake's governance and access control. Pick it when the data already lives in Fabric and the graph is for analysis.

Neo4j is a standalone graph database that applications read and write directly, queried with Cypher and GQL, and it runs outside Microsoft's platform. Pick it for application workloads or when your data is not in OneLake.
