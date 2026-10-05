import assert from "node:assert/strict";
import test from "node:test";

const { licenseTier, isOpenSource, licenseSchema } = await import("./license-tier.ts");

// Every licence string in the catalogue, with the tier it must land in.
const EXPECTED = {
  "Apache-2.0": "Permissive",
  "MIT": "Permissive",
  "BSD-3-Clause": "Permissive",
  "MPL-2.0": "Permissive",
  "PostgreSQL": "Permissive",
  "MIT OR Apache-2.0": "Permissive",
  "Apache-2.0 OR MIT": "Permissive",
  "Zlib OR MIT OR Apache-2.0": "Permissive",
  "MPL-1.1": "Permissive",
  "GPL-3.0": "Copyleft",
  "GPL-2.0": "Copyleft",
  "AGPL-3.0": "Copyleft",
  "OSL-3.0": "Copyleft",
  "GPL-3.0 OR AGPL-3.0": "Copyleft",
  "LGPL-2.1 OR GPL-2.0 OR Apache-2.0": "Copyleft",
  "GPL-1.0-or-later OR Artistic-1.0-Perl": "Copyleft",
  "Artistic-1.0-Perl OR GPL-1.0-or-later": "Copyleft",
  "Proprietary": "Proprietary",
  "BUSL-1.1": "Other",
  "SSPL-1.0": "Other",
  "Elastic-2.0": "Other",
  "MIT + Commons Clause": "Other",
  // Spellings that appear in the rankings snapshot rather than the catalogue.
  "BSL-1.1": "Other",
  "ELv2": "Other",
  "Artistic-2.0": "Permissive",
  "EPL-2.0": "Copyleft",
  "LGPL-2.1": "Copyleft",
  "BSL-1.0": "Permissive",
};

test("classifies every catalogue licence", () => {
  for (const [license, tier] of Object.entries(EXPECTED)) {
    assert.equal(licenseTier(license), tier, license);
  }
});

test("source-available licences are not open source", () => {
  for (const license of ["BUSL-1.1", "BSL-1.1", "SSPL-1.0", "Elastic-2.0", "ELv2", "MIT + Commons Clause"]) {
    assert.equal(isOpenSource(license), false, license);
  }
  assert.equal(isOpenSource("Proprietary"), false);
  assert.equal(isOpenSource(null), false);
});

test("permissive and copyleft licences are open source", () => {
  for (const license of ["Apache-2.0", "MIT OR Apache-2.0", "GPL-3.0", "AGPL-3.0"]) {
    assert.equal(isOpenSource(license), true, license);
  }
});

test("links single SPDX identifiers and names licence expressions", () => {
  assert.equal(licenseSchema("Apache-2.0"), "https://spdx.org/licenses/Apache-2.0.html");
  assert.equal(licenseSchema("BUSL-1.1"), "https://spdx.org/licenses/BUSL-1.1.html");
  assert.deepEqual(licenseSchema("MIT OR Apache-2.0"), { "@type": "CreativeWork", name: "MIT OR Apache-2.0" });
  assert.deepEqual(licenseSchema("MIT + Commons Clause"), { "@type": "CreativeWork", name: "MIT + Commons Clause" });
  assert.equal(licenseSchema("Proprietary"), undefined);
  assert.equal(licenseSchema(undefined), undefined);
});
