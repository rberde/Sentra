import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateBaselineRisk, simulateRiskBucket } from "./risk-engine.ts";

function makeProfile(overrides = {}) {
  return {
    id: "u1",
    name: "Test",
    monthlyIncome: 5000,
    incomeStreams: [],
    cashBuffer: 3000,
    fixedExpenses: [
      { name: "Rent", amount: 2000, category: "housing", type: "fixed" },
    ],
    variableExpenses: [
      { name: "Food", amount: 800, category: "food", type: "variable" },
    ],
    savingsGoal: {
      name: "Emergency",
      targetAmount: 20000,
      targetDate: "2030-01-01",
      currentBalance: 5000,
      monthlyContribution: 200,
    },
    investments: { totalValue: 100000, monthlyContribution: 500 },
    allocation: {
      fixedExpenses: 40,
      variableExpenses: 16,
      investments: 10,
      savingsGoal: 4,
      cashBuffer: 30,
    },
    goalWeights: { lifestyle: 1, savingsGoal: 1, investmentDiscipline: 1 },
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

function incomeShock(severity, duration = 6) {
  return {
    events: [
      {
        id: "e1",
        type: "income_shock",
        name: "Income cut",
        severity,
        duration,
        isActive: true,
      },
    ],
  };
}

function marketShock(severity, duration = 6) {
  return {
    events: [
      {
        id: "e2",
        type: "market_shock",
        name: "Crash",
        severity,
        duration,
        isActive: true,
      },
    ],
  };
}

describe("simulateRiskBucket stressed risk score", () => {
  it("does not improve risk score after a partial income shock", () => {
    const profile = makeProfile();
    const baseline = calculateBaselineRisk(profile);
    const stress = simulateRiskBucket(profile, incomeShock(50));

    assert.equal(stress.riskScoreBefore, baseline);
    assert.ok(
      stress.riskScoreAfter > stress.riskScoreBefore,
      `expected risk to worsen after 50% income cut, got ${stress.riskScoreBefore} → ${stress.riskScoreAfter}`,
    );
    assert.ok(stress.riskScoreDelta > 0);
  });

  it("does not improve risk score after a market shock via savings double-count", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, marketShock(40));

    // Portfolio is not in the baseline formula, so score may be unchanged —
    // but it must never look safer after a crash.
    assert.ok(
      stress.riskScoreAfter >= stress.riskScoreBefore,
      `expected market shock not to improve risk, got ${stress.riskScoreBefore} → ${stress.riskScoreAfter}`,
    );
  });

  it("worsens risk after full job loss", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, incomeShock(100));

    assert.ok(
      stress.riskScoreAfter > stress.riskScoreBefore,
      `expected full job loss to raise risk, got ${stress.riskScoreBefore} → ${stress.riskScoreAfter}`,
    );
  });

  it("does not double-count savings when scoring post-shock liquidity", () => {
    const profile = makeProfile({
      cashBuffer: 1000,
      savingsGoal: {
        name: "Emergency",
        targetAmount: 20000,
        targetDate: "2030-01-01",
        currentBalance: 9000,
        monthlyContribution: 0,
      },
      investments: { totalValue: 50000, monthlyContribution: 0 },
      monthlyIncome: 4000,
      fixedExpenses: [
        { name: "Rent", amount: 1500, category: "housing", type: "fixed" },
      ],
      variableExpenses: [
        { name: "Food", amount: 500, category: "food", type: "variable" },
      ],
    });

    // No shock: baseline uses cash+savings once.
    const baseline = calculateBaselineRisk(profile);

    // Zero-severity income shock still builds a stressed profile; liquidity
    // accounting must match baseline (no stuffing cash+savings into cashBuffer).
    const stress = simulateRiskBucket(profile, incomeShock(0));
    assert.equal(stress.riskScoreAfter, baseline);
  });
});
