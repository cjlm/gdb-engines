import assert from "node:assert/strict";
import test from "node:test";

const { headToHeadLinks } = await import("./head-to-head.ts");

const engines = [
  { slug: "neo4j", name: "Neo4j" },
  { slug: "bangdb", name: "BangDB" },
  { slug: "cogdb", name: "CogDB" },
];

test("links published pairs to their static page in alphabetical slug order", () => {
  const links = headToHeadLinks(engines, new Set(["bangdb-vs-neo4j", "cogdb-vs-neo4j", "bangdb-vs-cogdb"]));
  assert.deepEqual(links, [
    { href: "/compare/bangdb-vs-neo4j/", label: "BangDB vs Neo4j" },
    { href: "/compare/cogdb-vs-neo4j/", label: "CogDB vs Neo4j" },
    { href: "/compare/bangdb-vs-cogdb/", label: "BangDB vs CogDB" },
  ]);
});

test("sends unpublished pairs to the custom builder instead of a missing page", () => {
  const links = headToHeadLinks(engines, new Set(["bangdb-vs-neo4j"]));
  assert.equal(links[2].href, "/compare/custom/?db=bangdb&db=cogdb");
  assert.ok(links.every((l) => !l.href.includes("cogdb-vs") && !l.href.includes("-vs-cogdb/")));
});

test("returns nothing for fewer than two engines", () => {
  assert.deepEqual(headToHeadLinks([engines[0]], new Set()), []);
});
