import assert from "node:assert/strict";
import test from "node:test";

import { simulateRiskBucket } from "./risk-engine";
import type { UserProfile } from "../types";

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "profile_test",
    name: "Test User",
    monthlyIncome: 5_000,
    incomeStreams: [{ name: "Salary", amount: 5_000, type: "fixed" }],
    fixedExpenses: [{ name: "Rent", amount: 1_000, category: "housing", type: "fixed" }],
    variableExpenses: [{ name: "Food", amount: 1_000, category: "food", type: "variable" }],
    investments: { totalValue: 10_000, monthlyContribution: 0 },
    savingsGoal: null,
    cashBuffer: 24_000,
    allocation: {
      fixedExpenses: 20,
      variableExpenses: 20,
      investments: 0,
      savingsGoal: 0,
      cashBuffer: 60,
    },
    goalWeights: { lifestyle: 5, savingsGoal: 3, investmentDiscipline: 2 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("structural drift increases post-stress risk score", () => {
  const result = simulateRiskBucket(baseProfile(), {
    events: [
      {
        id: "drift",
        type: "structural_drift",
        name: "Lifestyle inflation",
        severity: 100,
        duration: 12,
        isActive: true,
      },
    ],
  });

  assert.equal(result.adjustedMonthlyBurn, 3_000);
  assert.ok(
    result.riskScoreAfter > result.riskScoreBefore,
    `expected risk score to increase, got before=${result.riskScoreBefore} after=${result.riskScoreAfter}`,
  );
});

test("lump-sum stress draws down savings without double-counting liquidity", () => {
  const result = simulateRiskBucket(
    baseProfile({
      cashBuffer: 5_000,
      savingsGoal: {
        name: "Emergency fund",
        targetAmount: 20_000,
        targetDate: "2026-12-31",
        currentBalance: 10_000,
        monthlyContribution: 0,
      },
    }),
    {
      events: [
        {
          id: "expense",
          type: "expense_shock",
          name: "Major repair",
          severity: 0,
          duration: 12,
          lumpSum: 12_000,
          isActive: true,
        },
      ],
    },
  );

  assert.equal(result.adjustedMonthlyBurn, 3_000);
  assert.ok(
    result.riskScoreAfter >= 90,
    `expected large liquidity drawdown to produce high risk, got ${result.riskScoreAfter}`,
  );
});
