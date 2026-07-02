import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateDriftCategories,
  calculateSpendingMonitor,
  getOverallDrift,
} from "./monitoring.ts";

test("spending monitor uses plan budget dollars as the cap", () => {
  const result = calculateSpendingMonitor({
    actualSpending: 1_800,
    planBudget: 1_500,
    thresholdPercent: 100,
  });

  assert.equal(result.variableCap, 1_500);
  assert.equal(result.percentUsed, 120);
  assert.equal(result.alert, true);
  assert.equal(result.alertLevel, "critical");
});

test("spending monitor does not inflate dollar budgets as income percentages", () => {
  const result = calculateSpendingMonitor({
    actualSpending: 1_800,
    planBudget: 1_500,
    thresholdPercent: 100,
  });

  assert.notEqual(result.variableCap, 75_000);
});

test("drift categories compare actual dollars to planned dollars", () => {
  const categories = calculateDriftCategories([
    { name: "Fixed", actual: 2_100, planned: 2_000 },
    { name: "Variable", actual: 1_800, planned: 1_500 },
    { name: "Investments", actual: 500, planned: 500 },
  ]);

  assert.deepEqual(categories, [
    { name: "Fixed", actual: 2_100, planned: 2_000, driftPct: 5 },
    { name: "Variable", actual: 1_800, planned: 1_500, driftPct: 20 },
    { name: "Investments", actual: 500, planned: 500, driftPct: 0 },
  ]);
  assert.equal(getOverallDrift(categories), 20);
});
