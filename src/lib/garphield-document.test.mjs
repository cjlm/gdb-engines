import assert from "node:assert/strict";
import test from "node:test";

test("prepares a themed clone without mutating the generated document", async () => {
  const { prepareGarphieldDocument } = await import(
    "./garphield-document.mjs"
  );
  const source = {
    config: {
      current: {
        state: { theme: "light" },
      },
    },
  };

  const prepared = prepareGarphieldDocument(source, "dark");

  assert.equal(prepared.config.current.state.theme, "dark");
  assert.equal(source.config.current.state.theme, "light");
  assert.notEqual(prepared, source);
});

test("preserves a legacy document without current view state", async () => {
  const { prepareGarphieldDocument } = await import(
    "./garphield-document.mjs"
  );
  const source = { config: { version: 1 } };

  const prepared = prepareGarphieldDocument(source, "dark");

  assert.deepEqual(prepared, source);
  assert.notEqual(prepared, source);
});
