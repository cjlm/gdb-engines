import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const generatedDocuments = [
  ["public/graphs/databases-languages.gfd", "Databases × query languages"],
  ["public/graphs/databases-similarity.gfd", "Database similarity"],
];

test("generated graph documents identify themselves in Garphield", async () => {
  const committed = new Map(
    await Promise.all(
      generatedDocuments.map(async ([path]) => [
        path,
        await readFile(path, "utf8"),
      ]),
    ),
  );
  execFileSync(process.execPath, ["scripts/generate-graphs.mjs"]);

  for (const [path, name] of generatedDocuments) {
    const generated = await readFile(path, "utf8");
    assert.equal(generated, committed.get(path), `${path} is stale`);

    const document = JSON.parse(generated);

    assert.deepEqual(document.config.current?.state.dataset, {
      kind: "file",
      name,
    });
  }
});
