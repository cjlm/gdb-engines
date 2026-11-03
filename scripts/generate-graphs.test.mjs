import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const generatedDocuments = [
  ["databases-languages.gfd", "Databases × query languages"],
  ["databases-similarity.gfd", "Database similarity"],
];

test("committed graph documents match the catalogue and name themselves", async () => {
  const out = await mkdtemp(join(tmpdir(), "graphs-"));
  const env = { ...process.env };
  delete env.PUBLIC_SITE_ORIGIN;
  execFileSync(process.execPath, ["scripts/generate-graphs.mjs", "--out", out], { env });

  for (const [filename, name] of generatedDocuments) {
    const generated = await readFile(join(out, filename), "utf8");
    const committed = await readFile(join("public/graphs", filename), "utf8");
    assert.equal(committed, generated, `public/graphs/${filename} is stale: run npm run graphs`);

    const document = JSON.parse(generated);
    assert.deepEqual(document.config.current?.state.dataset, { kind: "file", name });
  }
});
