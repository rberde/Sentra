import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateDurationAwarePressure,
  simulateRiskBucket,
} from "./risk-engine.ts";

function makeProfile(overrides = {}) {
  return {
    id: "u1",
    name: "Test",
    monthlyIncome: 5000,
    incomeStreams: [{ name: "Salary", amount: 5000, type: "fixed" }],
    fixedExpenses: [
      { name: "Rent", amount: 2000, category: "housing", type: "fixed" },
    ],
    variableExpenses: [
      { name: "Food", amount: 600, category: "food", type: "variable" },
      {
        name: "Entertainment",
        amount: 400,
        category: "entertainment",
        type: "variable",
      },
    ],
    investments: { totalValue: 100000, monthlyContribution: 500 },
    savingsGoal: {
      name: "Emergency",
      targetAmount: 20000,
      targetDate: "2027-01-01",
      currentBalance: 10000,
      monthlyContribution: 300,
    },
    cashBuffer: 15000,
    allocation: {
      fixedExpenses: 40,
      variableExpenses: 20,
      investments: 10,
      savingsGoal: 6,
      cashBuffer: 24,
    },
    goalWeights: { lifestyle: 5, savingsGoal: 5, investmentDiscipline: 5 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("compound duration-aware pressure", () => {
  it("keeps single income-shock pressure as monthly living gap × duration", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "e1",
          type: "income_shock",
          name: "Job Loss",
          severity: 100,
          duration: 3,
          isActive: true,
        },
      ],
    });

    // Burn $3,000/mo with $0 income for 3 months.
    assert.equal(stress.additionalExpense, 9000);
    assert.equal(stress.crisisDurationMonths, 3);
  });

  it("counts expense-shock totals once (no amortization × horizon double-count)", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "e2",
          type: "expense_shock",
          name: "Medical",
          severity: 0,
          duration: 12,
          lumpSum: 12000,
          isActive: true,
        },
      ],
    });

    assert.equal(stress.additionalExpense, 12000);
    assert.equal(stress.crisisDurationMonths, 12);
  });

  it("does not extend a short income shock across a longer expense horizon", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "e1",
          type: "income_shock",
          name: "Job Loss",
          severity: 100,
          duration: 3,
          isActive: true,
        },
        {
          id: "e2",
          type: "expense_shock",
          name: "Medical",
          severity: 0,
          duration: 12,
          lumpSum: 12000,
          isActive: true,
        },
      ],
    });

    // Bug: peak gap $4,000 × max(duration)=12 → $48,000.
    // Correct: living gap $3,000 × 3 + medical $12,000 = $21,000.
    assert.equal(stress.additionalExpense, 21000);
    assert.equal(stress.crisisDurationMonths, 12);
    assert.ok(
      stress.additionalExpense < 48000,
      "must not use peak monthly gap × longest horizon",
    );
  });

  it("matches helper math for stacked shocks with unequal durations", () => {
    const profile = makeProfile();
    const scenario = {
      events: [
        {
          id: "e1",
          type: "income_shock",
          name: "Job Loss",
          severity: 100,
          duration: 3,
          isActive: true,
        },
        {
          id: "e2",
          type: "expense_shock",
          name: "Medical",
          severity: 0,
          duration: 12,
          lumpSum: 12000,
          isActive: true,
        },
      ],
    };
    const baselineBurn = 3000;
    assert.equal(
      calculateDurationAwarePressure(profile, scenario, baselineBurn),
      21000,
    );
  });

  it("Resolve In shrinks vs peak-gap×max-duration for stacked shocks", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "e1",
          type: "income_shock",
          name: "Job Loss",
          severity: 100,
          duration: 3,
          isActive: true,
        },
        {
          id: "e2",
          type: "expense_shock",
          name: "Medical",
          severity: 0,
          duration: 12,
          lumpSum: 12000,
          isActive: true,
        },
      ],
    });

    const freeablePerMonth =
      stress.constraintMap.softConstraints +
      stress.constraintMap.pausable +
      stress.constraintMap.redirectable;
    const timelineToResolve = Math.ceil(
      stress.additionalExpense / freeablePerMonth,
    );

    // freeable = 1000 + 500 + 300 = 1800 → ceil(21000/1800)=12, not ceil(48000/1800)=27.
    assert.equal(freeablePerMonth, 1800);
    assert.equal(timelineToResolve, 12);
    assert.ok(timelineToResolve < 27);
  });
});
