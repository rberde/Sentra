/**
 * Spending-cap alerts must fire when a crisis plan sets variable budget to $0.
 * Regression: checkSpendingCap used to early-return on planBudget <= 0.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSpendingCapUsage,
  evaluateSpendingCapBreach,
  formatSpendingCapMessage,
} from "./spending-cap.ts";

test("zero plan budget alerts urgently on any positive variable spend", () => {
  const breach = evaluateSpendingCapBreach({
    planBudget: 0,
    actualSpending: 1200,
    thresholdPct: 100,
  });

  assert.deepEqual(breach, { overByPct: null, severity: "urgent" });
  assert.match(
    formatSpendingCapMessage(1200, 0, breach),
    /plan budget of \$0\/mo/,
  );
});

test("zero plan budget stays quiet when actual spend is also zero", () => {
  assert.equal(
    evaluateSpendingCapBreach({ planBudget: 0, actualSpending: 0 }),
    null,
  );
});

test("positive plan budget still alerts when spend exceeds threshold", () => {
  const breach = evaluateSpendingCapBreach({
    planBudget: 1000,
    actualSpending: 1600,
    thresholdPct: 100,
  });

  assert.deepEqual(breach, { overByPct: 60, severity: "urgent" });
});

test("positive plan budget respects threshold headroom", () => {
  assert.equal(
    evaluateSpendingCapBreach({
      planBudget: 1000,
      actualSpending: 1050,
      thresholdPct: 110,
    }),
    null,
  );
});

test("server usage helper alerts on $0 cap without divide-by-zero", () => {
  assert.deepEqual(
    calculateSpendingCapUsage({
      planBudget: 0,
      actualSpending: 800,
      thresholdPct: 100,
    }),
    { variableCap: 0, percentUsed: 100, alert: true },
  );

  assert.deepEqual(
    calculateSpendingCapUsage({
      planBudget: 0,
      actualSpending: 0,
      thresholdPct: 100,
    }),
    { variableCap: 0, percentUsed: 0, alert: false },
  );

  assert.deepEqual(
    calculateSpendingCapUsage({
      planBudget: 2000,
      actualSpending: 2500,
      thresholdPct: 100,
    }),
    { variableCap: 2000, percentUsed: 125, alert: true },
  );
});
