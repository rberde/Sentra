import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const monitoringUrl = pathToFileURL(path.join(process.cwd(), "src/lib/engine/monitoring.ts")).href;

test("spending cap uses plan monthly dollars directly", async () => {
  const { getPercentUsed, getVariableSpendingCap } = await import(`${monitoringUrl}?test=spending`);

  const cap = getVariableSpendingCap({ variableExpenses: 1500 });
  assert.equal(cap, 1500);
  assert.equal(getPercentUsed(2000, cap), 133);
});

test("drift helpers compare matching units", async () => {
  const { getDollarDriftCategories, getIncomePercentDrifts } = await import(`${monitoringUrl}?test=drift`);
  const reallocation = { fixedExpenses: 3000, variableExpenses: 1500, investments: 1000 };

  assert.deepEqual(
    getDollarDriftCategories({
      actualFixed: 3000,
      actualVariable: 2000,
      actualInvestment: 1000,
      reallocation,
    }),
    [
      { name: "Fixed Expenses", actual: 3000, planned: 3000, driftPct: 0 },
      { name: "Variable Expenses", actual: 2000, planned: 1500, driftPct: 33 },
      { name: "Investments", actual: 1000, planned: 1000, driftPct: 0 },
    ],
  );

  assert.deepEqual(
    getIncomePercentDrifts({
      income: 10000,
      actualFixed: 3000,
      actualVariable: 2000,
      actualInvestment: 1000,
      reallocation,
    }),
    [
      { name: "Fixed", actual: 30, planned: 30, drift: 0 },
      { name: "Variable", actual: 20, planned: 15, drift: 5 },
      { name: "Investments", actual: 10, planned: 10, drift: 0 },
    ],
  );
});
