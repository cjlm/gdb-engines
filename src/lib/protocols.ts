/**
 * Client wire protocols — the transport an application uses to reach an engine.
 *
 * Distinct from `query_languages`, which is the language sent over that transport: an engine
 * speaking Cypher over Bolt has query language "Cypher" and protocol "Bolt". The point of the
 * column is migration compatibility — two engines sharing a protocol share their client drivers.
 *
 * There is deliberately no tag for in-process/embedded use. It isn't a wire protocol, `kind`
 * already records it, and when it was in the vocabulary it was the single largest source of
 * disagreement between independent research passes — dual-mode engines like JanusGraph embed
 * *and* serve network clients, and no consistent rule emerged for them. Engines with no network
 * protocol simply omit the field.
 *
 * Unlike `query_languages` this is a closed vocabulary enforced by the content schema. Query
 * languages accumulated label variants for years (hence `canonicalQueryLanguage`); starting
 * closed here avoids repeating that.
 */

export const PROTOCOLS = [
  'Bolt',
  'HTTP/REST',
  'SPARQL Protocol',
  'Gremlin (WebSocket)',
  'Gremlin (HTTP)',
  'gRPC',
  'PostgreSQL wire',
  'Redis RESP',
  'Thrift',
  'JDBC/ODBC',
  'GraphQL (HTTP)',
  'WebSocket',
  'Native binary',
  'Unknown',
] as const;

export type Protocol = (typeof PROTOCOLS)[number];

export const protocolDescriptions: Record<Protocol, string> = {
  'Bolt': 'Neo4j’s binary protocol. Shared by the Neo4j-compatible family, so their drivers interchange.',
  'HTTP/REST': 'A general HTTP/JSON API.',
  'SPARQL Protocol': 'SPARQL 1.1 query and update over HTTP — the standard RDF store interface.',
  'Gremlin (WebSocket)': 'Apache TinkerPop Gremlin Server over WebSocket.',
  'Gremlin (HTTP)': 'Apache TinkerPop Gremlin Server over HTTP.',
  'gRPC': 'gRPC with protobuf-encoded messages.',
  'PostgreSQL wire': 'The PostgreSQL frontend/backend protocol, inherited by Postgres extensions.',
  'Redis RESP': 'The Redis serialization protocol, used by Redis modules.',
  'Thrift': 'Apache Thrift RPC.',
  'JDBC/ODBC': 'Standard SQL database connectors.',
  'GraphQL (HTTP)': 'GraphQL over HTTP.',
  'WebSocket': 'A WebSocket API that is not TinkerPop’s Gremlin channel.',
  'Native binary': 'A proprietary TCP or binary protocol specific to this engine.',
  'Unknown': 'Not determinable from public sources.',
};

/** Display order: standardised and widely shared protocols first, then the catch-alls. */
const DISPLAY_ORDER: readonly Protocol[] = PROTOCOLS;

export function sortProtocols(values: readonly string[]): string[] {
  const rank = (p: string) => {
    const i = DISPLAY_ORDER.indexOf(p as Protocol);
    return i === -1 ? DISPLAY_ORDER.length : i;
  };
  return [...values].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * `Unknown` records an absence of data rather than a shared transport, so it never groups engines
 * usefully — excluded from filters and roundups.
 */
export function isInteroperableProtocol(p: string): boolean {
  return p !== 'Unknown';
}
