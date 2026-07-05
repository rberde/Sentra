import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDollarDriftCategories,
  calculatePercentDriftCategories,
  calculateSpendingUsage,
} from "./monitoring.ts";

test("spending usage treats monthlyReallocation.variableExpenses as dollars", () => {
  assert.deepEqual(
    calculateSpendingUsage(1_200, { variableExpenses: 800 }),
    { variableCap: 800, percentUsed: 150 },
  );
});

test("n8n drift converts planned dollar buckets to income percentages", () => {
  assert.deepEqual(
    calculatePercentDriftCategories({
      income: 5_000,
      totalFixed: 2_000,
      totalVariable: 1_200,
      monthlyInvestment: 500,
      reallocation: {
        fixedExpenses: 2_000,
        variableExpenses: 800,
        investments: 500,
      },
    }),
    [
      { name: "Fixed", actual: 40, planned: 40, drift: 0 },
      { name: "Variable", actual: 24, planned: 16, drift: 8 },
      { name: "Investments", actual: 10, planned: 10, drift: 0 },
    ],
  );
});

test("monitor drift compares actual dollars to planned dollar buckets", () => {
  assert.deepEqual(
    calculateDollarDriftCategories({
      actualFixed: 2_000,
      actualVariable: 1_200,
      actualInvestment: 500,
      reallocation: {
        fixedExpenses: 2_000,
        variableExpenses: 800,
        investments: 500,
      },
    }),
    [
      { name: "Fixed Expenses", actual: 2_000, planned: 2_000, driftPct: 0 },
      { name: "Variable Expenses", actual: 1_200, planned: 800, driftPct: 50 },
      { name: "Investments", actual: 500, planned: 500, driftPct: 0 },
    ],
  );
});
