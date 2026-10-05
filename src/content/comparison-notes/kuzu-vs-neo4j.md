---
reviewed: '2026-10-05'
sources:
  - { title: "KuzuDB archive notice", url: "https://kuzudb.github.io/" }
  - { title: "BetaKit: Apple acquires Kuzu", url: "https://betakit.com/apple-strikes-deal-to-acquire-canadian-database-software-startup-kuzu/" }
  - { title: "Neo4j Operations Manual: editions", url: "https://neo4j.com/docs/operations-manual/current/introduction/" }
---
Kuzu is no longer maintained. Apple agreed to acquire Kuzu Inc in October 2025 and the project's repository is archived. Its MIT-licensed code continues in [LadybugDB](/db/ladybugdb/), a community fork that, like Kuzu, runs embedded inside an application, is queried with openCypher and is aimed at analytical workloads.

Neo4j runs as a server that several applications can share. Pick it over LadybugDB when you need a commercially supported database, clustering (Enterprise Edition) or Neo4j's tooling. Pick LadybugDB when an in-process, MIT-licensed graph engine fits better.
