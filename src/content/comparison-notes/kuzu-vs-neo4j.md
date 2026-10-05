---
reviewed: '2026-10-05'
sources:
  - { title: "KuzuDB archive notice", url: "https://kuzudb.github.io/" }
  - { title: "BetaKit: Apple acquires Kuzu", url: "https://betakit.com/apple-strikes-deal-to-acquire-canadian-database-software-startup-kuzu/" }
  - { title: "Neo4j Operations Manual: editions", url: "https://neo4j.com/docs/operations-manual/current/introduction/" }
---
Kuzu is no longer maintained. Apple agreed to acquire Kuzu Inc in October 2025 and the project's repository is archived. Its MIT-licensed code continues in community forks: [LadybugDB](/db/ladybugdb/), [Bighorn](/db/bighorn/) and [RyuGraph](/db/ryugraph/). Like Kuzu, they run embedded inside an application and are queried with openCypher, aimed at analytical workloads.

Neo4j runs as a server that several applications can share. Pick it over a Kuzu fork when you need a maintained database with a vendor behind it, clustering (Enterprise Edition) or Neo4j's tooling. Pick a fork when an in-process, MIT-licensed graph engine fits better.
