import assert from "node:assert/strict";
import test from "node:test";

import { calculateBudgetDrift, calculateSpendingUsage } from "./monitoring.ts";

test("spending usage treats reallocation variable expenses as monthly dollars", () => {
  const result = calculateSpendingUsage(2_500, { variableExpenses: 2_000 }, 100);

  assert.deepEqual(result, {
    variableCap: 2_000,
    percentUsed: 125,
    alert: true,
  });
});

test("spending usage does not alert while spending is exactly at the threshold", () => {
  const result = calculateSpendingUsage(1_600, { variableExpenses: 2_000 }, 80);

  assert.equal(result.percentUsed, 80);
  assert.equal(result.alert, false);
});

test("budget drift compares actual and planned shares of monthly income", () => {
  const result = calculateBudgetDrift(
    10_000,
    {
      fixedExpenses: 4_000,
      variableExpenses: 3_500,
      investments: 1_500,
    },
    {
      fixedExpenses: 4_000,
      variableExpenses: 2_000,
      investments: 1_500,
    },
  );

  assert.equal(result.overallDrift, 15);
  assert.deepEqual(
    result.categories.map(category => ({
      name: category.name,
      actual: category.actual,
      planned: category.planned,
      actualPct: category.actualPct,
      plannedPct: category.plannedPct,
      driftPct: category.driftPct,
    })),
    [
      { name: "Fixed Expenses", actual: 4_000, planned: 4_000, actualPct: 40, plannedPct: 40, driftPct: 0 },
      { name: "Variable Expenses", actual: 3_500, planned: 2_000, actualPct: 35, plannedPct: 20, driftPct: 15 },
      { name: "Investments", actual: 1_500, planned: 1_500, actualPct: 15, plannedPct: 15, driftPct: 0 },
    ],
  );
});
