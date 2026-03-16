// Column definitions for table headers
export const columnTooltips: Record<string, string> = {
  name: 'Graph database, engine, or extension name',
  vendor: 'Company or organization developing the product',
  type: 'Graph data model: LPG (Labeled Property Graph), RDF (Resource Description Framework), Multiple (supports both LPG and RDF), or Other',
  kind: 'Product type: database, extension (e.g. PostGIS for Postgres), query engine, or embedded library',
  category: 'Market position: Established (widely adopted), Enterprise (major vendor platform), Growing (active with users, not yet widely adopted), or Emerging (new/experimental)',
  status: 'Active, Inactive (no recent development), or Deprecated (officially discontinued)',
  gdotv: 'Supported by G.V() graph visualization tool (gdotv.com)',
  license: 'Software license (SPDX identifier or Proprietary)',
  query_languages: 'Query languages supported by this database',
};

export const featureDisplayNames: Record<string, string> = {
  active_development: "Active development",
  commercial_support: "Commercial support",
  live_community: "Live community",
  open_source: "Open Source",
  pricing: "Pricing",
  trendiness: "Trendiness",
  containerization: "Containerization",
  work_as_dedicated_instance: "Work as dedicated instance",
  work_as_embedded: "Work as embedded",
  testing_in_memory_version: "Testing in-memory version",
  operating_on_linux: "Operating on Linux",
  operating_on_windows: "Operating on Windows",
  saas_offering: "SaaS offering",
  automatic_updates: "Automatic updates",
  client_side_caching: "Client side caching",
  data_versioning_support: "Data versioning support",
  live_backups: "Live backups",
  cluster_rebalancing: "Cluster Re-balancing",
  data_distribution: "Data Distribution",
  high_availability: "High-Availability",
  query_distribution: "Query Distribution",
  replication_support: "Replication support",
  data_types_defined: "Data types defined",
  logging_auditing: "Logging/Auditing",
  object_graph_mapper: "Object-Graph Mapper",
  reactive_programming: "Reactive programming",
  documentation_up_to_date: "Documentation up-to-date",
  binary_protocol: "Binary protocol",
  cli: "CLI",
  gui: "GUI",
  multi_database: "Multi-database",
  graph_native_data: "Graph-native data",
  rest_api: "REST API",
  query_language: "Query Language",
  granular_locking: "Granular locking",
  multiple_isolation_levels: "Multiple isolation levels",
  read_committed_transaction: "Read committed transaction",
  transaction_support: "Transaction support",
  constraints: "Constraints",
  schema_support: "Schema support",
  secondary_indexes: "Secondary indexes",
  server_side_procedures: "Server side procedures",
  triggers: "Triggers",
  authentication: "Authentication",
  authorization: "Authorization",
  data_encryption: "Data encryption",
};

export const featureDescriptions: Record<string, string> = {
  active_development: "Score 1 if the GDB has been updated within three months before July 2023. Score 0.5 if the GDB has been updated within 3-6 months before July 2023. Otherwise, if it has not been updated in the last 6 months before July 2023, score 0.",
  commercial_support: "Score 1 if there is a designated team that provides paid support for the GDB. Otherwise, score 0.",
  live_community: "Score 1 if more than 75% of the issues addressed by users/customers/developers have been addressed. Score 0.75 if 50%-75% of the issues have been addressed. Score 0.5 if 25%-50% issues have been addressed. Score 0.25 if less than 25% of the issues have been addressed. Score 0 if no information available.",
  open_source: "Score 1 if the source code is freely available with an open source license (Apache-2.0, GPLv3,...). Score 0.5 if the source code is available but commercially restrictive. Otherwise, score 0.",
  pricing: "Score 1 if at least starting or approximate prices are available on the GDB web page, or the GDB has an open license. Otherwise, with no price information, score 0.",
  trendiness: "Score 1 if for July 2022 - July 2023 the Google Trends of the GDB have had a constant or a growing trend. Score 0 if the trend has been downward, or no data for the trend are available.",
  containerization: "Score 1 if a container image such as Docker is offered. Otherwise, score 0.",
  work_as_dedicated_instance: "Score 1 if the GDB can be run as an individual instance. Otherwise, if it is available exclusively in embedded mode, score 0.",
  work_as_embedded: "Score 1 if it is possible to run the GDB as embedded in the application (e.g. in the same JVM). Otherwise, score 0.",
  testing_in_memory_version: "Score 1 if there is an in-memory option of the GDB when data are stored in the memory, not on disk (e.g. for testing purposes). Otherwise, score 0.",
  operating_on_linux: "Score 1 if Linux is explicitly supported. Score 0.75 if the GDB code is open source. Score 0.5 if a Docker image is provided. Otherwise, score 0.",
  operating_on_windows: "Score 1 if Windows is explicitly supported. Score 0.75 if the GDB code is open source. Score 0.5 if a Docker image is provided. Otherwise, score 0.",
  saas_offering: "Score 1 if the provider offers its GDB as a service. Otherwise, score 0.",
  automatic_updates: "Score 1 if there are mechanisms to seamlessly update the GDB automatically. Otherwise, score 0.",
  client_side_caching: "Score 1 if the GDB provides a local cache in an application memory on the client side. Otherwise, score 0.",
  data_versioning_support: "Score 1 if the GDB supports versioning of stored data. Otherwise, score 0.",
  live_backups: "Score 1 if the GDB supports live backups. Otherwise, score 0.",
  cluster_rebalancing: "Score 1 if the GDB is able to rebalance its original data distribution across the cluster more efficiently. Otherwise, score 0.",
  data_distribution: "Score 1 if the GDB enables data sharding, meaning it can shard the data across several host servers. Otherwise, score 0.",
  high_availability: "Score 1 if there are mechanisms to achieve high-availability (included when the storage layer is a graph-unaware data storage (e.g. HBase) with mechanisms for high-availability). Otherwise, score 0.",
  query_distribution: "Score 1 if the GDB enables running a query over its distributed data in a distributed manner - that is, it can either assign the query to a correct partition, or it can assemble the distributed partial results back into a correct result. Otherwise, score 0.",
  replication_support: "Score 1 if the GDB has some replication mechanisms. Otherwise, score 0.",
  data_types_defined: "Score 1 if a composite data type is provided (no matter how). Score 0.5 if only basic data types are enabled. Otherwise, if only one data type is available (e.g. all data as String), score 0.",
  logging_auditing: "Score 1 if the GDB logs important events. Otherwise, score 0.",
  object_graph_mapper: "Score 1 if there exists a tool for automatic data conversion between the GDB and an object-oriented programming language. Otherwise, score 0.",
  reactive_programming: "Score 1 if the GDB supports reactive streams that provide asynchronous processing. Otherwise, score 0.",
  documentation_up_to_date: "Score 1 if the documentation has been updated for the last version of the GDB. Score 0.5 if it exists but has not been updated for the last version. Otherwise, score 0.",
  binary_protocol: "Score 1 if the graph database provides an option to communicate via a binary protocol. Otherwise, score 0.",
  cli: "Score 1 if the GDB can receive commands via a CLI interface. Otherwise, score 0.",
  gui: "Score 1 if the GDB provides a visual interface. Otherwise, score 0.",
  multi_database: "Score 1 if the GDB is a multi-model database (i.e. you can also use it as e.g. a document, or a key/value, or an object store). Otherwise, score 0.",
  graph_native_data: "Score 1 if the GDB is graph-native, i.e. it is designed to both store and process data as a graph. Otherwise, if e.g. the GDB has a graph abstraction over a key-value store, score 0.",
  rest_api: "Score 1 if a REST endpoint functionality is offered to interact with the database. Otherwise, score 0.",
  query_language: "Score 1 if the GDB can be queried with Cypher/Gremlin or any other widely accepted query language for GDBs. Score 0.5 if a non-standard/proprietary query language is provided. Otherwise, if no query language is provided, score 0.",
  granular_locking: "Score 1 if the GDB allows locking of specific objects (usually nodes). Otherwise, if no specific-object locking mechanism is implemented, score 0.",
  multiple_isolation_levels: "Score 1 if more than one higher-level isolation level is available, i.e. other level than 'read uncommitted'. Score 0.5 if only one higher-level isolation level is available. Otherwise, if only 'read uncommitted' isolation level is available, score 0.",
  read_committed_transaction: "Score 1 if a 'read committed' transaction is available. Otherwise, score 0.",
  transaction_support: "Score 1 if the GDB supports transactions. Otherwise, score 0.",
  constraints: "Score 1 if constraints can be set in the GDB. Score 0.5 if only uniqueness constraint is available. Otherwise, score 0.",
  schema_support: "Score 1 if there is a direct tool for defining a schema. Score 0.5 if only constraints and triggers are available. Otherwise, score 0.",
  secondary_indexes: "Score 1 if any additional index from the primary index is supported. An example can be a single-property index on another property than a 'primary key', a composite index, a vertex-centric index, full-text index (often provided with an incorporated external tool), etc. Otherwise, score 0.",
  server_side_procedures: "Score 1 if the GDB enables server-side (also 'stored') procedures. Otherwise, score 0.",
  triggers: "Score 1 if the GDB enables server-side events (also 'triggers'). Otherwise, score 0.",
  authentication: "Score 1 if the GDB supports some authentication method. Otherwise, score 0.",
  authorization: "Score 1 if the GDB provides any means for authorization (e.g. roles or privileges). Otherwise, score 0.",
  data_encryption: "Score 1 if the GDB provides a possibility to encrypt stored data. Otherwise, score 0.",
};

export const scoreMeanings: Record<string, Record<string, string>> = {
  active_development: {
    "0": "No updates in 6+ months",
    "1": "Updated within last 3 months",
    "0.5": "Updated 3-6 months ago",
  },
  commercial_support: {
    "0": "No commercial support",
    "1": "Paid support available",
  },
  live_community: {
    "0": "No community activity data",
    "1": ">75% of issues addressed",
    "0.75": "50-75% of issues addressed",
    "0.5": "25-50% of issues addressed",
    "0.25": "<25% of issues addressed",
  },
  open_source: {
    "0": "Closed source",
    "1": "Open source license",
    "0.5": "Source available but restrictive",
  },
  pricing: {
    "0": "No pricing information",
    "1": "Pricing publicly available",
  },
  trendiness: {
    "0": "Declining trend",
    "1": "Growing or stable trend",
  },
  containerization: {
    "0": "No container image",
    "1": "Docker image available",
  },
  work_as_dedicated_instance: {
    "0": "Embedded mode only",
    "1": "Can run as standalone server",
  },
  work_as_embedded: {
    "0": "Standalone only",
    "1": "Can embed in application",
  },
  testing_in_memory_version: {
    "0": "No in-memory option",
    "1": "In-memory mode available",
  },
  operating_on_linux: {
    "0": "Not supported",
    "1": "Linux officially supported",
    "0.75": "Open source (Linux compatible)",
    "0.5": "Docker image available",
  },
  operating_on_windows: {
    "0": "Not supported",
    "1": "Windows officially supported",
    "0.75": "Open source (Windows compatible)",
    "0.5": "Docker image available",
  },
  saas_offering: {
    "0": "Self-hosted only",
    "1": "Cloud service available",
  },
  automatic_updates: {
    "0": "Manual updates only",
    "1": "Automatic updates supported",
  },
  client_side_caching: {
    "0": "No client-side caching",
    "1": "Client-side cache available",
  },
  data_versioning_support: {
    "0": "No versioning",
    "1": "Version control for data",
  },
  live_backups: {
    "0": "No live backups",
    "1": "Hot backup supported",
  },
  cluster_rebalancing: {
    "0": "No auto-rebalancing",
    "1": "Auto-rebalancing supported",
  },
  data_distribution: {
    "0": "No sharding",
    "1": "Data sharding supported",
  },
  high_availability: {
    "0": "No HA support",
    "1": "HA mechanisms available",
  },
  query_distribution: {
    "0": "No distributed queries",
    "1": "Distributed query execution",
  },
  replication_support: {
    "0": "No replication",
    "1": "Replication available",
  },
  data_types_defined: {
    "0": "Single data type (strings)",
    "1": "Composite data types",
    "0.5": "Basic data types only",
  },
  logging_auditing: {
    "0": "No logging/auditing",
    "1": "Event logging supported",
  },
  object_graph_mapper: {
    "0": "No object mapper",
    "1": "OGM/ORM available",
  },
  reactive_programming: {
    "0": "No reactive programming",
    "1": "Reactive streams supported",
  },
  documentation_up_to_date: {
    "0": "No documentation",
    "1": "Docs current with latest version",
    "0.5": "Docs exist but outdated",
  },
  binary_protocol: {
    "0": "Text-based protocols only",
    "1": "Binary protocol available",
  },
  cli: {
    "0": "No CLI",
    "1": "Command-line interface",
  },
  gui: {
    "0": "No GUI",
    "1": "Visual interface available",
  },
  multi_database: {
    "0": "Graph-only",
    "1": "Multi-model database",
  },
  graph_native_data: {
    "0": "Graph abstraction layer",
    "1": "Native graph storage",
  },
  rest_api: {
    "0": "No REST API",
    "1": "REST endpoint available",
  },
  query_language: {
    "0": "No query language",
    "1": "Standard query language (Cypher/Gremlin)",
    "0.5": "Proprietary query language",
  },
  granular_locking: {
    "0": "No granular locking",
    "1": "Object-level locking",
  },
  multiple_isolation_levels: {
    "0": "Read uncommitted only",
    "1": "Multiple isolation levels",
    "0.5": "Single isolation level",
  },
  read_committed_transaction: {
    "0": "Not available",
    "1": "Read committed available",
  },
  transaction_support: {
    "0": "No transactions",
    "1": "ACID transactions",
  },
  constraints: {
    "0": "No constraints",
    "1": "Full constraint support",
    "0.5": "Uniqueness constraints only",
  },
  schema_support: {
    "0": "Schema-less",
    "1": "Schema definition tools",
    "0.5": "Constraints/triggers only",
  },
  secondary_indexes: {
    "0": "Primary index only",
    "1": "Secondary indexes supported",
  },
  server_side_procedures: {
    "0": "No stored procedures",
    "1": "Stored procedures supported",
  },
  triggers: {
    "0": "No triggers",
    "1": "Event triggers supported",
  },
  authentication: {
    "0": "No authentication",
    "1": "Authentication supported",
  },
  authorization: {
    "0": "No authorization",
    "1": "Role-based access control",
  },
  data_encryption: {
    "0": "No encryption",
    "1": "Data encryption supported",
  },
};

export const featureGroups: { name: string; features: string[] }[] = [
  {
    name: "Community & Business",
    features: ["active_development", "commercial_support", "live_community", "open_source", "pricing", "trendiness"],
  },
  {
    name: "Deployment",
    features: ["containerization", "work_as_dedicated_instance", "work_as_embedded", "testing_in_memory_version"],
  },
  {
    name: "Platform",
    features: ["operating_on_linux", "operating_on_windows", "saas_offering"],
  },
  {
    name: "Operations",
    features: ["automatic_updates", "client_side_caching", "data_versioning_support", "live_backups"],
  },
  {
    name: "Distribution",
    features: ["cluster_rebalancing", "data_distribution", "high_availability", "query_distribution", "replication_support"],
  },
  {
    name: "Developer Experience",
    features: ["data_types_defined", "logging_auditing", "object_graph_mapper", "reactive_programming", "documentation_up_to_date", "binary_protocol", "cli", "gui"],
  },
  {
    name: "Data Model",
    features: ["multi_database", "graph_native_data", "rest_api", "query_language"],
  },
  {
    name: "Transactions",
    features: ["granular_locking", "multiple_isolation_levels", "read_committed_transaction", "transaction_support"],
  },
  {
    name: "Schema & Security",
    features: ["constraints", "schema_support", "secondary_indexes", "server_side_procedures", "triggers", "authentication", "authorization", "data_encryption"],
  },
];
