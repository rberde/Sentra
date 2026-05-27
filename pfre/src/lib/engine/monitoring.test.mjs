import assert from "node:assert/strict";
import test from "node:test";

import { calculateDriftCategories, calculateSpendingUsage } from "./monitoring.ts";

test("spending usage treats plan reallocation values as monthly dollars", () => {
  const usage = calculateSpendingUsage(3_000, { variableExpenses: 1_500 });

  assert.equal(usage.variableCap, 1_500);
  assert.equal(usage.percentUsed, 200);
});

test("drift categories compare actual monthly dollars to planned monthly dollars", () => {
  const categories = calculateDriftCategories(
    { fixedExpenses: 2_100, variableExpenses: 1_800, investments: 500 },
    { fixedExpenses: 2_000, variableExpenses: 1_500, investments: 500 },
  );

  assert.deepEqual(categories, [
    { name: "Fixed Expenses", actual: 2_100, planned: 2_000, driftPct: 5 },
    { name: "Variable Expenses", actual: 1_800, planned: 1_500, driftPct: 20 },
    { name: "Investments", actual: 500, planned: 500, driftPct: 0 },
  ]);
});
