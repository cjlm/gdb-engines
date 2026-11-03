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

test("embeds draw canvas marks in the site's accent for each theme", async () => {
  const { setEmbedAccent } = await import("./garphield-document.mjs");
  const css = (await import("node:fs")).readFileSync("src/styles/global.css", "utf8");
  const accents = [...css.matchAll(/--color-brand-accent:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
  const url = new URL("https://garphield.com/embed?chrome=-wordmark");

  setEmbedAccent(url);

  assert.equal(url.searchParams.get("accent"), accents[0]);
  assert.equal(url.searchParams.get("accentDark"), accents[1]);
  assert.equal(url.searchParams.get("chrome"), "-wordmark");
});
