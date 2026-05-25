import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBudgetDriftCategories,
  calculateSpendingUsage,
  normalizeSpendingThresholdPercent,
} from "./monitoring.ts";

test("spending usage treats monthly reallocation as a dollar budget", () => {
  const result = calculateSpendingUsage(
    1_500,
    { variableExpenses: 1_200 },
    100,
  );

  assert.equal(result.variableCap, 1_200);
  assert.equal(result.percentUsed, 125);
  assert.equal(result.thresholdPercent, 100);
  assert.equal(result.alert, true);
  assert.equal(result.alertLevel, "critical");
});

test("legacy AI spending rules with dollar thresholds are normalized to 100 percent", () => {
  assert.equal(normalizeSpendingThresholdPercent(1_200), 100);

  const result = calculateSpendingUsage(
    1_500,
    { variableExpenses: 1_200 },
    1_200,
  );

  assert.equal(result.thresholdPercent, 100);
  assert.equal(result.alert, true);
});

test("drift compares actual and planned dollar buckets as percentages of income", () => {
  const categories = calculateBudgetDriftCategories(
    5_000,
    {
      fixedExpenses: 2_100,
      variableExpenses: 1_000,
      investments: 500,
    },
    {
      fixedExpenses: 2_000,
      variableExpenses: 1_000,
      investments: 500,
    },
  );

  assert.deepEqual(
    categories.map(({ name, actual, planned, actualPct, plannedPct, driftPct }) => ({
      name,
      actual,
      planned,
      actualPct,
      plannedPct,
      driftPct,
    })),
    [
      {
        name: "Fixed Expenses",
        actual: 2_100,
        planned: 2_000,
        actualPct: 42,
        plannedPct: 40,
        driftPct: 2,
      },
      {
        name: "Variable Expenses",
        actual: 1_000,
        planned: 1_000,
        actualPct: 20,
        plannedPct: 20,
        driftPct: 0,
      },
      {
        name: "Investments",
        actual: 500,
        planned: 500,
        actualPct: 10,
        plannedPct: 10,
        driftPct: 0,
      },
    ],
  );
});
