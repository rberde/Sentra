import assert from "node:assert/strict";
import test from "node:test";

import { calculateDriftCategories, calculateSpendingMonitor } from "./monitoring";

test("spending monitor treats rebalancing plan values as dollar budgets", () => {
  const result = calculateSpendingMonitor(2_000, 1_600, 100);

  assert.equal(result.variableCap, 1_600);
  assert.equal(result.percentUsed, 125);
  assert.equal(result.alert, true);
  assert.equal(result.alertLevel, "critical");
});

test("spending monitor applies threshold as a percent of the dollar budget", () => {
  const result = calculateSpendingMonitor(950, 1_000, 90);

  assert.equal(result.variableCap, 1_000);
  assert.equal(result.percentUsed, 95);
  assert.equal(result.alert, true);
});

test("drift categories compare actual and planned dollars as percentage points of income", () => {
  const [variable] = calculateDriftCategories(8_000, [
    { name: "Variable", actual: 2_000, planned: 1_600 },
  ]);

  assert.equal(variable.actual, 2_000);
  assert.equal(variable.planned, 1_600);
  assert.equal(variable.actualPct, 25);
  assert.equal(variable.plannedPct, 20);
  assert.equal(variable.driftPct, 5);
});
