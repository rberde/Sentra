import assert from "node:assert/strict";
import { test } from "node:test";

import { simulateRiskBucket } from "./risk-engine.ts";

const baseProfile = {
  id: "profile_1",
  name: "Test User",
  monthlyIncome: 4000,
  incomeStreams: [],
  fixedExpenses: [{ name: "Rent", amount: 3000, category: "housing", type: "fixed" }],
  variableExpenses: [{ name: "Food", amount: 1000, category: "food", type: "variable" }],
  investments: { totalValue: 50000, monthlyContribution: 500 },
  savingsGoal: null,
  cashBuffer: 20000,
  allocation: {
    fixedExpenses: 75,
    variableExpenses: 25,
    investments: 0,
    savingsGoal: 0,
    cashBuffer: 0,
  },
  goalWeights: {
    lifestyle: 5,
    savingsGoal: 5,
    investmentDiscipline: 5,
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("spreads multi-month expense shocks without double-counting the lump sum", () => {
  const result = simulateRiskBucket(baseProfile, {
    events: [{
      id: "event_1",
      type: "expense_shock",
      name: "Medical bill",
      severity: 100,
      duration: 12,
      lumpSum: 12000,
      isActive: true,
    }],
  });

  assert.equal(result.adjustedMonthlyBurn, 5000);
  assert.equal(result.additionalExpense, 12000);
  assert.equal(result.liquidityRunway, 20);
});
