import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAllocationDriftCategories,
  calculateUsagePercent,
  getMaxDriftPct,
  getMonthlyPlanAmount,
} from "./monitoring.ts";

test("spending monitors use plan values as monthly dollars", () => {
  const reallocation = { variableExpenses: 1200 };
  const variableCap = getMonthlyPlanAmount(reallocation, "variableExpenses");

  assert.equal(variableCap, 1200);
  assert.equal(calculateUsagePercent(1500, variableCap), 125);
});

test("drift monitors compare actual dollars to planned dollars", () => {
  const categories = buildAllocationDriftCategories(
    { fixedExpenses: 2400, variableExpenses: 1500, investments: 900 },
    { fixedExpenses: 2400, variableExpenses: 1200, investments: 900 },
  );

  assert.deepEqual(categories, [
    { name: "Fixed Expenses", actual: 2400, planned: 2400, driftPct: 0 },
    { name: "Variable Expenses", actual: 1500, planned: 1200, driftPct: 25 },
    { name: "Investments", actual: 900, planned: 900, driftPct: 0 },
  ]);
  assert.equal(getMaxDriftPct(categories), 25);
});
