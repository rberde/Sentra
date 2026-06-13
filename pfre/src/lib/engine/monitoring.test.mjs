import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAllocationDrift,
  calculateSpendingUsage,
} from "./monitoring.ts";

test("spending usage compares actual spend to the plan dollar cap", () => {
  const spending = calculateSpendingUsage({
    actualSpending: 2500,
    reallocation: { variableExpenses: 2000 },
    threshold: 100,
  });

  assert.equal(spending.variableCap, 2000);
  assert.equal(spending.percentUsed, 125);
  assert.equal(spending.alert, true);
});

test("allocation drift converts plan dollars to income percentages", () => {
  const drift = calculateAllocationDrift({
    income: 10000,
    actualFixed: 4000,
    actualVariable: 2000,
    actualInvestment: 1000,
    reallocation: {
      fixedExpenses: 4000,
      variableExpenses: 2000,
      investments: 1000,
    },
    threshold: 10,
  });

  assert.equal(drift.overallDrift, 0);
  assert.equal(drift.alert, false);
  assert.deepEqual(
    drift.categories.map(category => ({
      key: category.key,
      actualPct: category.actualPct,
      plannedPct: category.plannedPct,
      driftPct: category.driftPct,
    })),
    [
      { key: "fixedExpenses", actualPct: 40, plannedPct: 40, driftPct: 0 },
      { key: "variableExpenses", actualPct: 20, plannedPct: 20, driftPct: 0 },
      { key: "investments", actualPct: 10, plannedPct: 10, driftPct: 0 },
    ],
  );
});
