import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAllocationDrift,
  calculateSpendingUsage,
} from "./monitoring.ts";

test("calculateSpendingUsage treats plan buckets as dollars", () => {
  const usage = calculateSpendingUsage(2500, { variableExpenses: 2000 });

  assert.deepEqual(usage, {
    variableCap: 2000,
    percentUsed: 125,
  });
});

test("calculateAllocationDrift compares actual and planned income percentages", () => {
  const drifts = calculateAllocationDrift({
    income: 8000,
    actualFixed: 3300,
    actualVariable: 2500,
    actualInvestment: 1000,
    reallocation: {
      fixedExpenses: 3200,
      variableExpenses: 2000,
      investments: 1200,
    },
  });

  assert.deepEqual(drifts.map(({ name, actual, planned, drift }) => ({
    name,
    actual,
    planned,
    drift,
  })), [
    { name: "Fixed", actual: 41, planned: 40, drift: 1 },
    { name: "Variable", actual: 31, planned: 25, drift: 6 },
    { name: "Investments", actual: 13, planned: 15, drift: 2 },
  ]);
});
