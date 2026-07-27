import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simulateRiskBucket } from "./risk-engine.ts";

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

/**
 * Mirrors generateRebalancingPlans' maximize_lifestyle allocation so we can
 * assert post-plan solvency without importing rebalancer (Node can't resolve
 * its extensionless ./risk-engine import).
 */
function lifestyleReallocation(cm, amountNeeded) {
  const lifestylePausable = Math.min(cm.pausable, amountNeeded);
  const lifestyleRedirectable = Math.min(
    cm.redirectable,
    Math.max(0, amountNeeded - lifestylePausable),
  );
  const lifestyleVariableCut = Math.max(
    0,
    amountNeeded - lifestylePausable - lifestyleRedirectable,
  );
  return {
    fixedExpenses: cm.hardConstraints,
    variableExpenses: Math.max(0, cm.softConstraints - lifestyleVariableCut),
    investments: Math.max(0, cm.pausable - lifestylePausable),
    savingsGoal: Math.max(0, cm.redirectable - lifestyleRedirectable),
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

  it("provides enough pressure for lifestyle cuts to close the cashflow gap", () => {
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

    const cm = stress.constraintMap;
    const recurringGap = Math.max(
      0,
      stress.adjustedMonthlyBurn - stress.adjustedIncome,
    );
    const maxFlexible = cm.softConstraints + cm.pausable + cm.redirectable;
    const amountNeeded = Math.min(recurringGap, maxFlexible);
    const r = lifestyleReallocation(cm, amountNeeded);
    const postPlanOutflow =
      r.fixedExpenses + r.variableExpenses + r.investments + r.savingsGoal;

    assert.equal(recurringGap, 3000);
    assert.equal(amountNeeded, 3000);
    assert.ok(
      postPlanOutflow <= stress.adjustedIncome,
      `expected outflow ${postPlanOutflow} <= income ${stress.adjustedIncome}`,
    );
    assert.equal(r.investments, 0);
    assert.equal(r.variableExpenses, 0);
    assert.equal(r.fixedExpenses, 3000);
  });

  it("includes savings contributions in the crisis burn", () => {
    const profile = makeProfile({
      investments: { totalValue: 100000, monthlyContribution: 0 },
      savingsGoal: {
        name: "House",
        targetAmount: 50000,
        targetDate: "2028-01-01",
        currentBalance: 10000,
        monthlyContribution: 800,
      },
    });
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "job-3",
          type: "income_shock",
          name: "Job Loss / Income Shock",
          severity: 50,
          duration: 6,
          isActive: true,
        },
      ],
    });

    assert.equal(stress.adjustedMonthlyBurn, 5800); // 5000 living + 800 savings
    assert.equal(stress.adjustedMonthlyBurn - stress.adjustedIncome, 2800);
  });
});
