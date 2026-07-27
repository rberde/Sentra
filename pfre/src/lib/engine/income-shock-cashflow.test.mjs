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
    fixedExpenses: [{ name: "Rent", amount: 3000, category: "housing", type: "fixed" }],
    variableExpenses: [{ name: "Food", amount: 2000, category: "food", type: "variable" }],
    investments: { totalValue: 100000, monthlyContribution: 1000 },
    savingsGoal: null,
    cashBuffer: 8000,
    allocation: {
      fixedExpenses: 50,
      variableExpenses: 33,
      investments: 17,
      savingsGoal: 0,
      cashBuffer: 0,
    },
    goalWeights: { lifestyle: 10, savingsGoal: 1, investmentDiscipline: 1 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("income shock cashflow includes contributions", () => {
  it("counts investment contributions in adjusted monthly burn", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "job-1",
          type: "income_shock",
          name: "Job Loss / Income Shock",
          severity: 50,
          duration: 12,
          isActive: true,
        },
      ],
    });

    // Living expenses 5000 + $1000 investment contribution.
    assert.equal(stress.adjustedMonthlyBurn, 6000);
    assert.equal(stress.adjustedIncome, 3000);
    // True cashflow hole is $3000/mo, not the $2000 expense-only gap.
    assert.equal(stress.adjustedMonthlyBurn - stress.adjustedIncome, 3000);
  });

  it("generates a lifestyle plan that closes the full cashflow gap", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "job-2",
          type: "income_shock",
          name: "Job Loss / Income Shock",
          severity: 50,
          duration: 12,
          isActive: true,
        },
      ],
    });

    const plans = generateRebalancingPlans(profile, stress);
    const lifestyle = plans.find((p) => p.type === "maximize_lifestyle");
    assert.ok(lifestyle);

    const r = lifestyle.monthlyReallocation;
    const postPlanOutflow =
      r.fixedExpenses + r.variableExpenses + r.investments + r.savingsGoal;
    // After cuts, monthly outflows must not exceed crisis income.
    assert.ok(
      postPlanOutflow <= stress.adjustedIncome,
      `expected outflow ${postPlanOutflow} <= income ${stress.adjustedIncome}`,
    );
    // Must pause the $1000 contribution and cut another $2000 from variable spend.
    assert.equal(r.investments, 0);
    assert.equal(r.variableExpenses, 0);
    assert.equal(r.fixedExpenses, 3000);
  });
});
