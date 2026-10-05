import assert from "node:assert/strict";
import test from "node:test";

const { mentionsByEngine } = await import("./blog-mentions.ts");

const engines = [
  { slug: "neo4j", name: "Neo4j" },
  { slug: "ladybugdb", name: "LadybugDB" },
  { slug: "traverse", name: "Traverse" },
  { slug: "apache-age", name: "Apache AGE" },
  { slug: "duckdb", name: "DuckDB" },
];
const ids = (map, slug) => (map.get(slug) ?? []).map((p) => p.id);

test("matches whole names, case-sensitively", () => {
  const map = mentionsByEngine([{ id: "a", body: "LadybugDB keeps climbing; neo4j in lower case does not count." }], engines);
  assert.deepEqual(ids(map, "ladybugdb"), ["a"]);
  assert.deepEqual(ids(map, "neo4j"), []);
});

test("does not match a name inside a longer word or slug", () => {
  const map = mentionsByEngine([{ id: "a", body: "Neo4jX and DuckDB-Wasm and myDuckDB" }], engines);
  assert.deepEqual(ids(map, "neo4j"), []);
  assert.deepEqual(ids(map, "duckdb"), []);
});

test("counts a link to the profile", () => {
  const map = mentionsByEngine([{ id: "a", body: "See [the extension](/db/apache-age/)." }], engines);
  assert.deepEqual(ids(map, "apache-age"), ["a"]);
});

test("needs a link for names that are ordinary words", () => {
  const map = mentionsByEngine(
    [{ id: "a", body: "Traverse the graph twice." }, { id: "b", body: "[Traverse](/db/traverse/) shipped." }],
    engines,
  );
  assert.deepEqual(ids(map, "traverse"), ["b"]);
});

test("ignores fenced code", () => {
  const map = mentionsByEngine([{ id: "a", body: "Text.\n```\nimport Neo4j\n```\n" }], engines);
  assert.deepEqual(ids(map, "neo4j"), []);
});
