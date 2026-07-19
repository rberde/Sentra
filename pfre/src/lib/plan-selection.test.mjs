import assert from "node:assert/strict";
import test from "node:test";

import { reconcileSelectedPlanId } from "./plan-selection.ts";

test("clears a selected plan that was replaced during regeneration", () => {
  assert.equal(
    reconcileSelectedPlanId("old-plan", [{ id: "new-plan-a" }, { id: "new-plan-b" }]),
    null,
  );
});

test("preserves a selected plan that remains in the plan set", () => {
  assert.equal(
    reconcileSelectedPlanId("selected-plan", [{ id: "other-plan" }, { id: "selected-plan" }]),
    "selected-plan",
  );
});
