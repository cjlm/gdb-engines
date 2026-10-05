import assert from "node:assert/strict";
import test from "node:test";

const { rankMovement } = await import("./rank-movement.ts");

test("a negative delta is a rise", () => {
  assert.deepEqual(rankMovement(-2), { text: "▲2", cls: "delta-up" });
});

test("a positive delta is a fall", () => {
  assert.deepEqual(rankMovement(1), { text: "▼1", cls: "delta-down" });
});

test("no change, new entries and missing history", () => {
  assert.deepEqual(rankMovement(0), { text: "=", cls: "delta-flat" });
  assert.deepEqual(rankMovement("new"), { text: "new", cls: "delta-new" });
  assert.deepEqual(rankMovement(null), { text: "", cls: "" });
  assert.deepEqual(rankMovement(undefined), { text: "", cls: "" });
});
