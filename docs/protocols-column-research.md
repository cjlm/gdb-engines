# Protocols column — research (issue #47)

Research for the proposed **"Protocols"** column requested in [issue #47](https://github.com/cjlm/gdb-engines/issues/47): the client–server **communication / wire protocols** each engine speaks, so users migrating between engines can see which products share a transport (e.g. Neo4j → another Bolt-speaking engine needs no client rewrite).

This is the *transport* layer, distinct from the existing `query_languages` (the *language*) column. A single engine often supports several.

## Status

Research-only. No schema change has been made. If adopted, the natural modelling is a `protocols` array on each TOML entry (mirroring `query_languages`), surfaced as a new table column. All 136 catalogue entries are covered below.

## Canonical protocol tags

A small controlled vocabulary keeps the column filterable:

| Tag | Meaning |
|-----|---------|
| `HTTP/REST` | Generic HTTP/JSON REST API |
| `SPARQL Protocol` | SPARQL 1.1 query/update over HTTP (the RDF-store standard) |
| `Bolt` | Neo4j Bolt binary protocol |
| `Gremlin (WebSocket)` / `Gremlin (HTTP)` | Apache TinkerPop server channels |
| `gRPC` | gRPC / protobuf |
| `PostgreSQL wire` | Postgres frontend/backend protocol (inherited by PG extensions) |
| `Redis RESP` | Redis serialization protocol (Redis modules) |
| `Thrift` | Apache Thrift RPC |
| `JDBC/ODBC` | Standard SQL DB connectors |
| `GraphQL (HTTP)` | GraphQL over HTTP |
| `WebSocket` | Generic WebSocket API |
| `Native binary` | Proprietary TCP/binary protocol (named where known) |
| `Embedded (in-process)` | Used as a library; no network protocol |
| `Unknown` | Could not be determined from public docs |

## Methodology & confidence

Researched with batched Haiku web-research agents, one row per engine. Confidence is **H** (official docs / README confirmed), **M** (reliable secondary source or inferred from architecture), or **L** (dormant/obscure project, undocumented protocol — treat as a placeholder needing manual confirmation). Verify any **L** and spot-check **M** before publishing.

## Proposed values

| Database | Protocols | Conf | Notes |
|----------|-----------|------|-------|
| 4store | SPARQL Protocol, HTTP/REST | H | RDF store; SPARQL endpoint over HTTP |
| Aerospike Graph | Gremlin (WebSocket) | H | TinkerPop-based |
| agdb | HTTP/REST, Embedded (in-process) | H | OpenAPI server; also embeddable |
| AgensGraph | PostgreSQL wire | H | PostgreSQL extension |
| Akutan | gRPC, SPARQL Protocol | M | RDF store; gRPC + SPARQL endpoints |
| Alibaba GDB | Gremlin (HTTP), Gremlin (WebSocket) | H | TinkerPop |
| AllegroGraph | HTTP/REST, SPARQL Protocol | H | HTTP protocol; Sesame-compatible |
| Altair Graph Lakehouse | gRPC, SPARQL Protocol | M | gRPC primary; optional SPARQL HTTP |
| Apache AGE | PostgreSQL wire | H | PostgreSQL extension |
| Apache Giraph | Native binary | H | Netty IPC; batch compute framework |
| Apache HugeGraph | HTTP/REST, Gremlin (HTTP) | H | REST + Gremlin HTTP |
| Apache Jena Fuseki | SPARQL Protocol, HTTP/REST | H | SPARQL server |
| Apache Rya | SPARQL Protocol, HTTP/REST | M | SPARQL via Sesame/OpenRDF |
| ArangoDB | HTTP/REST | H | RESTful JSON API (VST removed in 3.12) |
| ArcadeDB | HTTP/REST, PostgreSQL wire, Bolt | H | Also Redis and MongoDB protocols |
| Atomic Server | HTTP/REST, WebSocket | H | WebSocket primary; HTTP alt |
| Attean | SPARQL Protocol, Embedded (in-process) | M | Perl framework; remote SPARQL client |
| BangDB | HTTP/REST, Native binary | H | TCP binary + REST |
| Bighorn | Embedded (in-process) | H | Kuzu fork; no network protocol |
| Google Cloud BigQuery Graph | HTTP/REST, gRPC | H | Cloud API; REST + gRPC client libs |
| Bitsy | Embedded (in-process), Gremlin (WebSocket) | M | Embeddable; Gremlin Server for network |
| BlazeGraph | SPARQL Protocol, HTTP/REST | H | NanoSparqlServer |
| BrightstarDB | HTTP/REST, SPARQL Protocol, Embedded (in-process) | H | Also TCP/named-pipe |
| ByteGraph | gRPC | M | Internal ByteDance; sparse public docs |
| ChronoGraph | Embedded (in-process) | H | Temporal TinkerPop library |
| CodeMix Graph | Embedded (in-process) | M | TypeScript in-memory library |
| CogDB | Embedded (in-process), HTTP/REST | H | Python lib; built-in REST server |
| Comunica | SPARQL Protocol, Embedded (in-process) | H | JS library; browser/Node/CLI |
| Cosmos DB | Gremlin (WebSocket), HTTP/REST | H | Gremlin API; native SDKs |
| Cray Graph Engine | SPARQL Protocol, HTTP/REST | M | RDF store; discontinued |
| Data Graphs | HTTP/REST | H | JSON-LD; Node/Python SDKs |
| DataStax Enterprise | Native binary (CQL), Gremlin (WebSocket) | H | TinkerPop over Cassandra native protocol |
| Dgraph | gRPC, HTTP/REST | H | gRPC primary (protobuf); REST secondary |
| DozerDB | Bolt, HTTP/REST | H | Neo4j CE plugin; standard Neo4j drivers |
| DuckPGQ | Embedded (in-process), PostgreSQL wire | H | DuckDB extension; in-process core |
| Dydra | SPARQL Protocol, HTTP/REST | H | Cloud RDF; Graph Store Protocol |
| Eclipse RDF4J | HTTP/REST, SPARQL Protocol, Embedded (in-process) | H | RDF4J protocol; embedded + server |
| Microsoft Fabric Graph | HTTP/REST | H | Single GQL POST endpoint; bearer-token |
| FalkorDBLite | Embedded (in-process), Redis RESP, Bolt | H | Auto-embeds Redis + module |
| FaunaDB | HTTP/REST | H | Custom FQL over HTTP; event streams |
| FlockDB | Thrift | H | Apache Thrift RPC |
| Fluree | HTTP/REST, WebSocket | H | JSON-LD over HTTP; WS subscriptions |
| froGQL | Embedded (in-process) | H | Single-file engine; Python/Node/WASM/Rust |
| G-Tran | Native binary (RDMA/TCP) | M | RDMA inter-node; TCP for clients |
| Gaffer | HTTP/REST | H | REST API |
| GalaxyBase | Bolt, HTTP/REST | H | Bolt 7687, Neo4j-compatible driver |
| GFQL | Embedded (in-process), HTTP/REST | H | Dataframe-native; REST when remote |
| Google Cayley | HTTP/REST | H | JSON query endpoints (port 64210) |
| Grafeo | gRPC, Bolt, HTTP/REST | H | gRPC GQL wire, Bolt v5; also embedded |
| Graph Engine | Native binary, HTTP/REST | M | Proprietary distributed-RAM protocol + REST |
| GraphBase | HTTP/REST | M | FactNexus EKG API over HTTP |
| Graphflow | Embedded (in-process) | H | Research prototype; no server |
| GraphLite | Embedded (in-process) | H | Embedded Rust library |
| GraphQLite | Embedded (in-process) | H | SQLite extension; no wire protocol |
| GraphScope | gRPC, HTTP/REST | H | gRPC inter-node; REST public interface |
| gStore | HTTP/REST, gRPC, Native binary | H | ghttp, gRPC, gserver socket API |
| GUN | WebSocket, HTTP/REST | H | P2P WebSocket sync; HTTP fallback |
| Halyard | SPARQL Protocol, HTTP/REST | M | RDF4J + HBase; SPARQL over HTTP |
| HelixDB | HTTP/REST | H | Port 6969; SDKs POST queries |
| HGraphDB | Embedded (in-process) | H | TinkerPop library over HBase; optional Gremlin |
| Huawei Graph Engine Service | HTTP/REST, Gremlin (HTTP) | H | Cloud GES API + SDKs |
| HyperGraphDB | Embedded (in-process) | M | Java embedded; P2P module uses XMPP |
| IBM System G | Native binary (RPC), HTTP/REST | M | Per architecture paper; discontinued |
| InfiniteGraph | Embedded (in-process) | M | Java API; vendor defunct |
| JanusGraph | Gremlin (WebSocket), Gremlin (HTTP) | H | TinkerPop; GraphBinary serialization |
| KatanaGraph | Embedded (in-process) | M | C++/Python in-process |
| KGLite | Embedded (in-process), Bolt | M | Kuzu-based; ships Bolt server crate |
| Kinetica | HTTP/REST, JDBC/ODBC | H | REST/JSON + SQL connectors |
| Kuzu | Embedded (in-process) | H | C++ core; multi-language bindings |
| LadybugDB | Embedded (in-process) | M | Kuzu fork; bindings, no wire protocol |
| Lance Graph | Embedded (in-process), HTTP/REST | L | Rust core; vector-centric, thin graph docs |
| LiveGraph | Embedded (in-process) | H | Academic C++ library; no networking |
| MarkLogic | HTTP/REST, SPARQL Protocol | H | Enterprise multi-model REST + SPARQL |
| Apache Marmotta KiWi | SPARQL Protocol, HTTP/REST | H | RDF store; RDF4J/Sesame Sail |
| MemGQL | Bolt | M | Memgraph variant; Bolt wire |
| Memgraph | Bolt | H | Neo4j-compatible Bolt |
| MillenniumDB | SPARQL Protocol, HTTP/REST | M | RDF + property graph; SPARQL/GQL |
| Mulgara | SPARQL Protocol, HTTP/REST | M | RDF store; legacy SOAP/RMI |
| NebulaGraph | Thrift, gRPC | H | fbthrift RPC client↔graphd |
| Neo4j | Bolt, HTTP/REST | H | Bolt binary + HTTP API |
| Neptune | Gremlin (WebSocket), SPARQL Protocol, Bolt, HTTP/REST | H | TinkerPop + SPARQL + openCypher (Bolt) |
| NodeDB | PostgreSQL wire, HTTP/REST, Redis RESP | M | Also NDB/ILP/Sync protocols |
| NornicDB | Bolt, HTTP/REST, GraphQL (HTTP), gRPC | H | Bolt 7687; REST/GraphQL 7474; Qdrant-compatible gRPC |
| Objectivity/DB | Embedded (in-process), JDBC/ODBC | M | ODMG bindings; SQL/ODBC; proprietary client-server |
| OmniGraph | HTTP/REST, Embedded (in-process) | H | OpenAPI server + local mode |
| ONgDB | Bolt, HTTP/REST | H | Neo4j 3.4 fork; Bolt 7687, HTTP 7474 |
| Ontop | SPARQL Protocol, HTTP/REST | M | Virtual knowledge graph; SPARQL endpoint |
| Ontotext GraphDB | SPARQL Protocol, HTTP/REST, GraphQL (HTTP), JDBC/ODBC | H | RDF4J-compatible SPARQL |
| Oracle Graph | JDBC/ODBC, HTTP/REST, SPARQL Protocol | H | Oracle Net/JDBC, PGX REST :7007, in-DB SPARQL |
| OrientDB | Native binary (port 2424), HTTP/REST | H | Binary 2424 + REST 2480 |
| Oxigraph | SPARQL Protocol, HTTP/REST | H | SPARQL 1.1 + Graph Store Protocol |
| OxiRS | SPARQL Protocol, HTTP/REST, GraphQL (HTTP) | H | Fuseki-compatible + GraphQL |
| PandaDB | Native binary (panda://) | M | Custom panda:// protocol + Java driver |
| Parliament | SPARQL Protocol, HTTP/REST | H | SPARQL endpoint (Joseki/Jetty) |
| pgGraph | PostgreSQL wire | H | PostgreSQL extension only |
| PostgreSQL SQL/PGQ | PostgreSQL wire | H | Native PostgreSQL wire |
| Prometheux | HTTP/REST | H | REST + MCP; connects out to data sources |
| PuppyGraph | Gremlin (WebSocket), Gremlin (HTTP) | M | Gremlin; also openCypher |
| QLever | SPARQL Protocol, HTTP/REST | H | SPARQL 1.1 HTTP + Graph Store Protocol |
| Quadstore | Embedded (in-process) | H | JS library, LevelDB-backed; no network |
| Quine | HTTP/REST, WebSocket | H | openCypher over REST + streaming |
| Raphtory | GraphQL (HTTP), Embedded (in-process) | M | GraphQL server; also embedded Python/Rust |
| RDF::Trine | Embedded (in-process), SPARQL Protocol | M | Perl library; optional SPARQL endpoint |
| RDFLib | Embedded (in-process) | H | Python library; optional SPARQL backend |
| RDFox | HTTP/REST, SPARQL Protocol, Embedded (in-process) | H | REST + SPARQL endpoint; also embedded |
| FalkorDB | Redis RESP, Bolt | H | Redis module (RESP); Bolt experimental |
| Redland | Embedded (in-process) | H | C library with language bindings |
| RedStore | SPARQL Protocol, HTTP/REST | M | Lightweight SPARQL HTTP server |
| RelationalAI | HTTP/REST | M | Cloud API, Python SDK, Snowflake-native |
| Rocketgraph | gRPC, HTTP/REST | M | Python client over gRPC; Arrow Flight |
| RushDB | HTTP/REST | M | REST API; JS/Python SDKs |
| RyuGraph | Embedded (in-process) | M | Embedded library, Kuzu-derived |
| SAP Hana | Native binary, JDBC/ODBC | H | SQL interfaces; graph via SQL engine |
| Sones GraphDB | HTTP/REST | M | REST service with XML responses |
| Google Cloud Spanner Graph | gRPC, HTTP/REST | H | Google Cloud API; client libraries |
| SparkleDB | Unknown | L | Dormant; no reliable protocol docs |
| Sparksee | Embedded (in-process) | M | Embedded C++ library with bindings |
| Stardog | SPARQL Protocol, HTTP/REST | H | SPARQL + REST; also Gremlin |
| StellarDB | Native binary (Thrift/HiveServer2) | L | Enterprise; limited public docs |
| Strabon | SPARQL Protocol | H | Spatial RDF store; SPARQL endpoint |
| SurrealDB | HTTP/REST, WebSocket | H | RPC over HTTP + WebSocket |
| TAO | Native binary (RPC) | M | Facebook-internal; multiplexed RPC |
| Tentris | SPARQL Protocol | H | SPARQL 1.1 Protocol endpoints |
| TerminusDB | HTTP/REST | H | REST API; default port 6363 |
| TigerGraph | HTTP/REST | H | REST++ |
| TinkerGraph | Embedded (in-process), Gremlin (WebSocket) | H | Embedded reference impl; remote via Gremlin Server |
| TribleSpace | Embedded (in-process) | H | Rust library; no network protocol |
| TuGraph | HTTP/REST, Bolt, gRPC (brpc) | H | brpc RPC + REST; Bolt support |
| TurboLynx | Embedded (in-process) | H | C++ in-process library (C API) |
| TuringDB | HTTP/REST, Native binary | M | REST + binary protocol (developing) |
| TypeDB | gRPC, HTTP/REST | H | gRPC primary; HTTP secondary |
| Ultipa | Native binary, HTTP/REST | H | Native binary port 60061 + HTTP/GraphQL |
| VelocityGraph | Embedded (in-process) | M | .NET embedded library |
| Virtuoso | SPARQL Protocol, HTTP/REST, JDBC/ODBC | H | SPARQL + ODBC/JDBC DB wire |
| Weaver | Native binary | M | Distributed transactional client API |
| ZipG | Embedded (in-process) | L | Research prototype; Succinct-based, undocumented |

## Entries needing manual verification (low confidence)

- **SparkleDB** — dormant since ~2018; protocol undocumented. Currently `Unknown`.
- **StellarDB** — enterprise, closed docs; `Native binary (Thrift/HiveServer2)` inferred.
- **ZipG**, **Lance Graph** — research/early projects with thin transport docs.
- All **M**-confidence rows (internal/discontinued products: ByteGraph, IBM System G, InfiniteGraph, TAO, Weaver, Graph Engine, PandaDB) should be confirmed against primary sources before publishing.

## Observations for column design

- **Embedded (in-process)** is the single most common value among newer engines (Kuzu, GraphLite, froGQL, TurboLynx, GraphQLite, …). Consider whether the column should show it, or treat embedded libraries as "no network protocol".
- **SPARQL Protocol** cleanly covers nearly every RDF store, and **Bolt** clusters the Neo4j-compatible family (Neo4j, ONgDB, DozerDB, Memgraph, GalaxyBase, FalkorDB, ArcadeDB, Neptune) — exactly the migration-compatibility signal issue #47 asks for.
- **PostgreSQL wire** groups the Postgres-extension engines (AGE, AgensGraph, pgGraph, SQL/PGQ, DuckPGQ).
