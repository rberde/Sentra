import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { drawDownLiquidity, simulateRiskBucket } from "./risk-engine.ts";

function makeProfile(overrides = {}) {
  return {
    id: "user-1",
    name: "Test",
    monthlyIncome: 6000,
    incomeStreams: [{ name: "Salary", amount: 6000, type: "fixed" }],
    fixedExpenses: [{ name: "Rent", amount: 2000, category: "housing", type: "fixed" }],
    variableExpenses: [{ name: "Food", amount: 800, category: "food", type: "variable" }],
    investments: { totalValue: 100000, monthlyContribution: 500 },
    savingsGoal: {
      name: "Emergency",
      targetAmount: 30000,
      targetDate: "2027-01-01",
      currentBalance: 20000,
      monthlyContribution: 300,
    },
    cashBuffer: 15000,
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

/** Mirror of rebalancer projectMonth — kept local so Node can test without path aliases. */
function projectMonth(
  startCash,
  startSavings,
  startInvestments,
  monthlyIncome,
  reallocation,
  months,
  investmentGrowthRate = 0.005,
) {
  let cash = startCash;
  let savings = startSavings;
  let investments = startInvestments;
  for (let m = 0; m < months; m++) {
    const totalExpenses = reallocation.fixedExpenses + reallocation.variableExpenses;
    cash +=
      monthlyIncome -
      totalExpenses -
      reallocation.investments -
      reallocation.savingsGoal +
      reallocation.cashBuffer;
    savings += reallocation.savingsGoal;
    investments = investments * (1 + investmentGrowthRate) + reallocation.investments;
    cash = Math.max(0, cash);
    savings = Math.max(0, savings);
  }
  return Math.round(cash + savings + investments);
}

describe("drawDownLiquidity", () => {
  it("pays from cash first, then savings", () => {
    const result = drawDownLiquidity(15000, 20000, 30000);
    assert.equal(result.cashBuffer, 0);
    assert.equal(result.savingsBalance, 5000);
  });

  it("leaves balances unchanged when there is no lump sum", () => {
    const result = drawDownLiquidity(15000, 20000, 0);
    assert.equal(result.cashBuffer, 15000);
    assert.equal(result.savingsBalance, 20000);
  });
});

describe("expense-shock plan projection starting balances", () => {
  it("exposes post-lump cash/savings so projections do not invent the unpaid bill", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "med-1",
          type: "expense_shock",
          name: "Medical / Expense Shock",
          severity: 100,
          duration: 1,
          lumpSum: 30000,
          isActive: true,
        },
      ],
    });

    // $15k cash + $20k savings − $30k bill → $0 cash, $5k savings.
    assert.equal(stress.stressedCashBuffer, 0);
    assert.equal(stress.stressedSavingsBalance, 5000);
    // Runway uses the same post-lump pool.
    assert.equal(stress.stressedCashBuffer + stress.stressedSavingsBalance, 5000);

    // Lifestyle-style realloc after flexible dollars are exhausted (pause contribs, cut variable).
    const realloc = {
      fixedExpenses: 2000,
      variableExpenses: 0,
      investments: 0,
      savingsGoal: 0,
      cashBuffer: 0,
    };

    const buggyNet = projectMonth(
      profile.cashBuffer,
      profile.savingsGoal.currentBalance,
      stress.portfolioStressValue,
      stress.adjustedIncome,
      realloc,
      6,
    );
    const fixedNet = projectMonth(
      stress.stressedCashBuffer,
      stress.stressedSavingsBalance,
      stress.portfolioStressValue,
      stress.adjustedIncome,
      realloc,
      6,
    );

    // Pre-shock starts overstated net worth by the full unpaid bill.
    assert.equal(buggyNet - fixedNet, 30000);
    assert.ok(fixedNet < buggyNet);
  });

  it("keeps pre-shock balances when there is no expense lump", () => {
    const profile = makeProfile();
    const stress = simulateRiskBucket(profile, {
      events: [
        {
          id: "job-1",
          type: "income_shock",
          name: "Job Loss",
          severity: 50,
          duration: 3,
          isActive: true,
        },
      ],
    });

    assert.equal(stress.stressedCashBuffer, 15000);
    assert.equal(stress.stressedSavingsBalance, 20000);
  });
});
