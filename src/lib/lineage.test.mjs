import assert from "node:assert/strict";
import test from "node:test";

const { buildFamilies, familyOf } = await import("./lineage.ts");

function db(slug, data = {}) {
  return { data: { slug, name: slug.toUpperCase(), status: "active", ...data } };
}

test("leaves out engines with no history on either side", () => {
  const families = buildFamilies([db("solo"), db("parent"), db("child", { lineage: { parent: { relation: "fork" } } })]);

  assert.equal(families.length, 1);
  assert.deepEqual(families[0].stations.map((s) => s.id).sort(), ["child", "parent"]);
});

test("chains former names into one line ending at the current name", () => {
  const [family] = buildFamilies([db("typedb", { previous_names: ["Grakn"], released: "2016" })]);
  const byId = new Map(family.stations.map((s) => [s.id, s]));

  assert.equal(byId.get("typedb~0").label, "Grakn");
  assert.equal(byId.get("typedb~0").released, "2016");
  assert.deepEqual(byId.get("typedb").parents, [{ id: "typedb~0", relation: "renamed" }]);
});

test("attaches a child to its parent's first name only through the current station", () => {
  const [family] = buildFamilies([
    db("blazegraph", { previous_names: ["Bigdata"] }),
    db("neptune", { lineage: { blazegraph: { relation: "based-on" } } }),
  ]);
  const neptune = family.stations.find((s) => s.id === "neptune");

  assert.deepEqual(neptune.parents, [{ id: "blazegraph", relation: "based-on" }]);
});

test("shares one external station between children and merges families across parents", () => {
  const families = buildFamilies([
    db("janusgraph", { lineage: { titan: { name: "Titan", relation: "fork" } } }),
    db("dse", { lineage: { titan: { name: "Titan", relation: "based-on" } } }),
    db("graphscope"),
    db("kuzu"),
    db("neug", { lineage: { graphscope: { relation: "based-on" }, kuzu: { relation: "borrows-from" } } }),
  ]);

  const titan = familyOf(families, "janusgraph");
  assert.equal(titan.stations.filter((s) => s.kind === "external").length, 1);
  assert.equal(familyOf(families, "dse"), titan);

  const neug = familyOf(families, "neug");
  assert.equal(familyOf(families, "kuzu"), neug);
  assert.equal(neug.stations.find((s) => s.id === "neug").parents.length, 2);
});

test("marks only the current station of an engine that is no longer developed", () => {
  const [family] = buildFamilies([db("akutan", { previous_names: ["Beam"], status: "inactive" })]);
  const ended = family.stations.filter((s) => s.ended).map((s) => s.id);

  assert.deepEqual(ended, ["akutan"]);
});
