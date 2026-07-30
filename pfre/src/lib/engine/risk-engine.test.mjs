import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simulateRiskBucket } from "./risk-engine.ts";

function makeProfile(overrides = {}) {
  return {
    id: "user-1",
    name: "Test",
    monthlyIncome: 6000,
    incomeStreams: [{ name: "Salary", amount: 6000, type: "fixed" }],
    fixedExpenses: [{ name: "Rent", amount: 2000, category: "housing", type: "fixed" }],
    variableExpenses: [{ name: "Food", amount: 1000, category: "food", type: "variable" }],
    investments: { totalValue: 50000, monthlyContribution: 500 },
    savingsGoal: {
      name: "Emergency",
      targetAmount: 20000,
      targetDate: "2027-01-01",
      currentBalance: 10000,
      monthlyContribution: 300,
    },
    cashBuffer: 40000,
    allocation: {
      fixedExpenses: 33,
      variableExpenses: 17,
      investments: 8,
      savingsGoal: 5,
      cashBuffer: 37,
    },
    goalWeights: { lifestyle: 5, savingsGoal: 5, investmentDiscipline: 5 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("income shock duration in depletion timeline", () => {
  it("restores income after a temporary job loss instead of draining for 24 months", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "job-1",
          type: "income_shock",
          name: "Job Loss",
          severity: 100,
          duration: 3,
          isActive: true,
        },
      ],
    });

    // Peak-crisis metrics still use the reduced income (for runway / plan pressure).
    assert.equal(stress.adjustedIncome, 0);
    assert.equal(stress.crisisDurationMonths, 3);
    assert.equal(stress.additionalExpense, 9000);

    const month3 = stress.depletionTimeline.find((m) => m.month === 3);
    const month4 = stress.depletionTimeline.find((m) => m.month === 4);
    const month12 = stress.depletionTimeline.find((m) => m.month === 12);
    assert.ok(month3 && month4 && month12);

    // Months 1-3: $3k/mo burn with $0 income → cash 40k - 9k = 31k.
    assert.equal(month3.cashBuffer, 31000);
    assert.equal(month3.cumulativeExpenses, 9000);

    // Month 4+: income returns; $3k surplus rebuilds buffers (half cash / half savings).
    assert.equal(month4.cashBuffer, 32500);
    assert.equal(month4.savingsBalance, 11500);
    assert.equal(month4.cumulativeExpenses - month3.cumulativeExpenses, 3000);

    // By month 12, liquidity must be recovering — not wiped by phantom post-crisis unemployment.
    assert.ok(month12.cashBuffer > month3.cashBuffer);
    assert.equal(month12.cashBuffer, 44500);
    assert.equal(month12.savingsBalance, 23500);
  });

  it("treats unknown income-shock duration as a 6-month timeline window", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "job-2",
          type: "income_shock",
          name: "Job Loss",
          severity: 100,
          duration: -1,
          isActive: true,
        },
      ],
    });

    assert.equal(stress.crisisDurationMonths, 6);

    const month6 = stress.depletionTimeline.find((m) => m.month === 6);
    const month7 = stress.depletionTimeline.find((m) => m.month === 7);
    assert.ok(month6 && month7);

    // 6 months of $3k draw from $40k cash → $22k remaining.
    assert.equal(month6.cashBuffer, 22000);
    // Month 7 recovers with restored income.
    assert.equal(month7.cashBuffer, 23500);
    assert.equal(month7.savingsBalance, 11500);
  });
});

describe("structural drift duration in depletion timeline", () => {
  it("stops applying lifestyle inflation after the stated duration", () => {
    const profile = makeProfile({
      cashBuffer: 5000,
      savingsGoal: {
        name: "Emergency",
        targetAmount: 20000,
        targetDate: "2027-01-01",
        currentBalance: 0,
        monthlyContribution: 0,
      },
    });
    // 50% variable increase on $1000 food = +$500/mo for 4 months only.
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "drift-1",
          type: "structural_drift",
          name: "Lifestyle Inflation",
          severity: 50,
          duration: 4,
          isActive: true,
        },
      ],
    });

    assert.equal(stress.adjustedMonthlyBurn, 3500);

    const month4 = stress.depletionTimeline.find((m) => m.month === 4);
    const month5 = stress.depletionTimeline.find((m) => m.month === 5);
    assert.ok(month4 && month5);

    // During drift: burn 3500, income 6000 → +2500 surplus/mo split across cash/savings.
    // After drift: burn returns to 3000 → +3000 surplus/mo.
    assert.equal(month4.cumulativeExpenses, 3500 * 4);
    assert.equal(month5.cumulativeExpenses - month4.cumulativeExpenses, 3000);
  });
});
