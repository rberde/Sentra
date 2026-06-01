import assert from "node:assert/strict";
import test from "node:test";

import {
  allocationDriftPercent,
  budgetUsagePercent,
  incomeSharePercent,
  plannedMonthlyAmount,
} from "./monitoring.ts";

test("active plan reallocation values are monthly dollar budgets", () => {
  const reallocation = {
    fixedExpenses: 2500,
    variableExpenses: 1800,
    investments: 700,
  };

  assert.equal(plannedMonthlyAmount(reallocation, "variableExpenses"), 1800);
  assert.equal(budgetUsagePercent(1980, plannedMonthlyAmount(reallocation, "variableExpenses")), 110);
});

test("allocation drift compares actual and planned shares of income", () => {
  const income = 6000;
  const plannedVariableBudget = 1800;
  const actualVariableSpending = 2100;

  assert.equal(incomeSharePercent(plannedVariableBudget, income), 30);
  assert.equal(incomeSharePercent(actualVariableSpending, income), 35);
  assert.equal(allocationDriftPercent(actualVariableSpending, plannedVariableBudget, income), 5);
});

test("missing or invalid budgets do not create bogus caps", () => {
  assert.equal(plannedMonthlyAmount(undefined, "variableExpenses"), 0);
  assert.equal(plannedMonthlyAmount({ variableExpenses: Number.NaN }, "variableExpenses"), 0);
  assert.equal(budgetUsagePercent(500, 0), 0);
  assert.equal(allocationDriftPercent(500, 250, 0), 0);
});
