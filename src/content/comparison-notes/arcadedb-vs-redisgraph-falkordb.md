---
reviewed: '2026-10-05'
sources:
  - { title: "FalkorDB README", url: "https://github.com/FalkorDB/FalkorDB" }
  - { title: "FalkorDB licence (SSPL v1)", url: "https://raw.githubusercontent.com/FalkorDB/FalkorDB/master/LICENSE.txt" }
  - { title: "ArcadeDB README", url: "https://github.com/ArcadeData/arcadedb" }
---
FalkorDB, formerly RedisGraph, runs as a Redis module. It stores adjacency as sparse matrices and executes openCypher queries as linear algebra, and it targets low-latency workloads such as GraphRAG and agent memory. It is licensed under SSPL v1, a source-available licence with conditions on offering it as a service. Pick FalkorDB if you already run Redis and need fast graph lookups.

ArcadeDB is Apache-2.0, including its Raft-based high availability. It stores graphs, documents, key/value pairs, time series, vectors and geospatial data in one engine, accepts Cypher, Gremlin and SQL, and speaks the Bolt, PostgreSQL and Redis wire protocols. It runs embedded on the JVM or as a server. Pick ArcadeDB for a permissive licence or several data models in one database.
