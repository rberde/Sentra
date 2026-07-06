import assert from "node:assert/strict";
import test from "node:test";

import { monthlyPlanAmount, percentOfIncome } from "./monitoring.ts";

test("monitoring plan buckets are treated as monthly dollars", () => {
  const reallocation = {
    fixedExpenses: 3000,
    variableExpenses: 1200,
    investments: 500,
    savingsGoal: 0,
    cashBuffer: 0,
  };

  assert.equal(monthlyPlanAmount(reallocation, "variableExpenses"), 1200);
  assert.equal(percentOfIncome(monthlyPlanAmount(reallocation, "variableExpenses"), 5000), 24);
});
