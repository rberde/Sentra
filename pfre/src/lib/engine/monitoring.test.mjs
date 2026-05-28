import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllocationDriftCategories,
  getPercentUsed,
  getVariableSpendingCap,
} from "./monitoring.ts";

test("spending monitor uses plan variable budget as dollars", () => {
  const cap = getVariableSpendingCap({ variableExpenses: 800 });
  const percentUsed = getPercentUsed(900, cap);

  assert.equal(cap, 800);
  assert.equal(percentUsed, 113);
});

test("drift monitor compares actual and planned dollars as income percentages", () => {
  const categories = getAllocationDriftCategories({
    income: 5_000,
    actualFixed: 2_000,
    actualVariable: 900,
    actualInvestment: 600,
    reallocation: {
      fixedExpenses: 2_000,
      variableExpenses: 800,
      investments: 750,
    },
  });

  assert.deepEqual(
    categories.map(category => ({
      key: category.key,
      actualPct: category.actualPct,
      plannedPct: category.plannedPct,
      driftPct: category.driftPct,
    })),
    [
      { key: "fixedExpenses", actualPct: 40, plannedPct: 40, driftPct: 0 },
      { key: "variableExpenses", actualPct: 18, plannedPct: 16, driftPct: 2 },
      { key: "investments", actualPct: 12, plannedPct: 15, driftPct: 3 },
    ],
  );
});
