import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simulateRiskBucket } from "./risk-engine.ts";
import { generateRebalancingPlans } from "./rebalancer.ts";

function makeProfile(overrides = {}) {
  return {
    id: "user-1",
    name: "Test",
    monthlyIncome: 6000,
    incomeStreams: [{ name: "Salary", amount: 6000, type: "fixed" }],
    fixedExpenses: [{ name: "Rent", amount: 2000, category: "housing", type: "fixed" }],
    variableExpenses: [{ name: "Food", amount: 800, category: "food", type: "variable" }],
    investments: { totalValue: 50000, monthlyContribution: 500 },
    savingsGoal: {
      name: "Emergency",
      targetAmount: 20000,
      targetDate: "2027-01-01",
      currentBalance: 8000,
      monthlyContribution: 300,
    },
    cashBuffer: 5000,
    allocation: {
      fixedExpenses: 33,
      variableExpenses: 13,
      investments: 8,
      savingsGoal: 5,
      cashBuffer: 41,
    },
    goalWeights: { lifestyle: 5, savingsGoal: 5, investmentDiscipline: 5 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("expense shock accounting", () => {
  it("does not double-count a $12k bill paid over 12 months", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "med-1",
          type: "expense_shock",
          name: "Medical / Expense Shock",
          severity: 100,
          duration: 12,
          lumpSum: 12000,
          isActive: true,
        },
      ],
    });

    // Total crisis pressure must equal the bill once — not 12k upfront + 12k installments.
    assert.equal(stress.additionalExpense, 12000);
    assert.equal(stress.adjustedMonthlyBurn, 2800 + 1000); // baseline 2800 + $1k/mo
    assert.equal(stress.crisisDurationMonths, 12);

    // Liquidity must not be reduced by the full 12k on top of the monthly burn.
    assert.equal(stress.constraintMap.availableLiquidity, 13000);
    // Stressed cash buffer mirrors available liquidity (cash + savings), not liquidity-12k.
    assert.ok(stress.liquidityRunway > 0);

    const plans = generateRebalancingPlans(profile, stress);
    assert.ok(plans.length > 0);
    // Monthly cut pressure should be ~$1,000 (the installment), not ~$2,000.
    const lifestyle = plans.find((p) => p.type === "maximize_lifestyle");
    assert.ok(lifestyle);
    const cutFromFlexible =
      (profile.variableExpenses[0].amount +
        profile.investments.monthlyContribution +
        profile.savingsGoal.monthlyContribution) -
      (lifestyle.monthlyReallocation.variableExpenses +
        lifestyle.monthlyReallocation.investments +
        lifestyle.monthlyReallocation.savingsGoal);
    assert.ok(
      cutFromFlexible >= 900 && cutFromFlexible <= 1100,
      `expected ~1000/mo cut, got ${cutFromFlexible}`,
    );
  });

  it("stops applying installment burn after the expense duration in the timeline", () => {
    const profile = makeProfile({
      monthlyIncome: 6000,
      fixedExpenses: [{ name: "Rent", amount: 2000, category: "housing", type: "fixed" }],
      variableExpenses: [{ name: "Food", amount: 800, category: "food", type: "variable" }],
    });
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "med-2",
          type: "expense_shock",
          name: "Medical / Expense Shock",
          severity: 100,
          duration: 3,
          lumpSum: 3000,
          isActive: true,
        },
      ],
    });

    // Months 1-3 include +$1000 shock; later months should not keep accruing it.
    const month3 = stress.depletionTimeline.find((m) => m.month === 3);
    const month4 = stress.depletionTimeline.find((m) => m.month === 4);
    assert.ok(month3 && month4);
    const burnThrough3 = month3.cumulativeExpenses;
    const burnMonth4 = month4.cumulativeExpenses - month3.cumulativeExpenses;
    assert.equal(burnThrough3, (2800 + 1000) * 3);
    assert.equal(burnMonth4, 2800);
  });

  it("treats a one-month expense as a single total cost", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "med-3",
          type: "expense_shock",
          name: "Medical / Expense Shock",
          severity: 100,
          duration: 1,
          lumpSum: 4000,
          isActive: true,
        },
      ],
    });

    assert.equal(stress.additionalExpense, 4000);
    assert.equal(stress.adjustedMonthlyBurn, 2800 + 4000);
    const month1 = stress.depletionTimeline.find((m) => m.month === 1);
    const month2 = stress.depletionTimeline.find((m) => m.month === 2);
    assert.equal(month1.cumulativeExpenses, 6800);
    assert.equal(month2.cumulativeExpenses - month1.cumulativeExpenses, 2800);
  });
});
