import assert from "node:assert";
import { shapeOk, isReserved } from "../word.js";
import { step, close } from "../wordrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, words: ["if", "then"],
  state: { names: [], uses: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "def", name: "a" }],
  bad_name_code: "E_BAD_NAME", reserved_code: "E_RESERVED",
  dup_code: "E_DUP_NAME", no_name_code: "E_NO_NAME",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("shapeOk returns a boolean", () => {
  assert.strictEqual(typeof shapeOk("a"), "boolean");
});

check("isReserved returns a boolean", () => {
  assert.strictEqual(typeof isReserved(["if"], "x"), "boolean");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
