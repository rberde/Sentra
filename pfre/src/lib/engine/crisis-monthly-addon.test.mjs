/**
 * Regression: plan projections / risk scores must include forced crisis burn
 * (expense-shock installments + structural lifestyle inflation).
 *
 * monthlyReallocation only reallocates baseline living buckets, so without
 * crisisMonthlyAddon, Projected Net Position invents ~$1k × N months of wealth.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { simulateRiskBucket } from "./risk-engine.ts";

function baseProfile(overrides = {}) {
  return {
    id: "test",
    name: "Test",
    monthlyIncome: 5000,
    incomeStreams: [],
    fixedExpenses: [{ name: "Rent", amount: 2000, category: "housing", type: "fixed" }],
    variableExpenses: [{ name: "Food", amount: 1000, category: "food", type: "variable" }],
    investments: { totalValue: 40000, monthlyContribution: 500 },
    savingsGoal: null,
    cashBuffer: 15000,
    allocation: { fixedExpenses: 40, variableExpenses: 20, investments: 10, savingsGoal: 0, cashBuffer: 30 },
    goalWeights: { lifestyle: 8, savingsGoal: 2, investmentDiscipline: 2 },
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

/** Mirrors rebalancer.projectMonth after the crisisMonthlyAddon fix. */
function projectNet(startCash, startSav, startInv, income, realloc, months, addon, growth = 0.005) {
  let cash = startCash;
  let savings = startSav;
  let investments = startInv;
  for (let m = 0; m < months; m++) {
    const totalExpenses = realloc.fixedExpenses + realloc.variableExpenses + addon;
    cash += income - totalExpenses - realloc.investments - realloc.savingsGoal + realloc.cashBuffer;
    savings += realloc.savingsGoal;
    investments = investments * (1 + growth) + realloc.investments;
    cash = Math.max(0, cash);
    savings = Math.max(0, savings);
  }
  return Math.round(cash + savings + investments);
}

function lifestyleRealloc(stress) {
  const cm = stress.constraintMap;
  const recurringGap = Math.max(0, stress.adjustedMonthlyBurn - stress.adjustedIncome);
  const lumpSumPressure = stress.additionalExpense > 0
    ? stress.additionalExpense / Math.max(1, stress.crisisDurationMonths)
    : 0;
  const rawNeeded = Math.max(recurringGap, lumpSumPressure);
  const maxFlexible = cm.softConstraints + cm.pausable + cm.redirectable;
  const amountNeeded = Math.max(0, Math.min(rawNeeded, maxFlexible));
  const pausable = Math.min(cm.pausable, amountNeeded);
  const redirectable = Math.min(cm.redirectable, Math.max(0, amountNeeded - pausable));
  const variableCut = Math.max(0, amountNeeded - pausable - redirectable);
  return {
    fixedExpenses: cm.hardConstraints,
    variableExpenses: Math.max(0, cm.softConstraints - variableCut),
    investments: Math.max(0, cm.pausable - pausable),
    savingsGoal: Math.max(0, cm.redirectable - redirectable),
    cashBuffer: 0,
  };
}

describe("crisisMonthlyAddon", () => {
  it("exposes expense-shock installments as crisisMonthlyAddon", () => {
    const stress = simulateRiskBucket(baseProfile(), {
      events: [{
        id: "e1",
        type: "expense_shock",
        name: "Medical",
        severity: 100,
        duration: 12,
        lumpSum: 12000,
        isActive: true,
      }],
    });
    assert.equal(stress.crisisMonthlyAddon, 1000);
    assert.equal(stress.adjustedMonthlyBurn, 4000);
  });

  it("exposes structural lifestyle inflation as crisisMonthlyAddon", () => {
    const stress = simulateRiskBucket(baseProfile({ monthlyIncome: 4000, investments: { totalValue: 50000, monthlyContribution: 0 }, cashBuffer: 12000, variableExpenses: [{ name: "Living", amount: 2000, category: "food", type: "variable" }] }), {
      events: [{
        id: "s1",
        type: "structural_drift",
        name: "Lifestyle Inflation",
        severity: 50,
        duration: 12,
        isActive: true,
      }],
    });
    assert.equal(stress.crisisMonthlyAddon, 1000);
    assert.equal(stress.adjustedMonthlyBurn, 5000);
    assert.ok(stress.riskScoreAfter > stress.riskScoreBefore, "structural drift must worsen risk score");
  });

  it("removes ~$12k ghost wealth from expense-shock plan projections", () => {
    const profile = baseProfile();
    const stress = simulateRiskBucket(profile, {
      events: [{
        id: "e1",
        type: "expense_shock",
        name: "Medical",
        severity: 100,
        duration: 12,
        lumpSum: 12000,
        isActive: true,
      }],
    });
    const realloc = lifestyleRealloc(stress);
    const buggy = projectNet(
      profile.cashBuffer, 0, stress.portfolioStressValue, stress.adjustedIncome, realloc, 12, 0,
    );
    const fixed = projectNet(
      profile.cashBuffer, 0, stress.portfolioStressValue, stress.adjustedIncome, realloc, 12, stress.crisisMonthlyAddon,
    );
    assert.equal(buggy - fixed, 12000);
    assert.ok(fixed < buggy);
  });

  it("removes ~$12k ghost wealth from structural-drift plan projections", () => {
    const profile = baseProfile({
      monthlyIncome: 4000,
      investments: { totalValue: 50000, monthlyContribution: 0 },
      cashBuffer: 12000,
      variableExpenses: [{ name: "Living", amount: 2000, category: "food", type: "variable" }],
    });
    const stress = simulateRiskBucket(profile, {
      events: [{
        id: "s1",
        type: "structural_drift",
        name: "Lifestyle Inflation",
        severity: 50,
        duration: 12,
        isActive: true,
      }],
    });
    const realloc = lifestyleRealloc(stress);
    const buggy = projectNet(
      profile.cashBuffer, 0, stress.portfolioStressValue, stress.adjustedIncome, realloc, 12, 0,
    );
    const fixed = projectNet(
      profile.cashBuffer, 0, stress.portfolioStressValue, stress.adjustedIncome, realloc, 12, stress.crisisMonthlyAddon,
    );
    // Plan cuts $1k living to cover $1k structural; without addon, projections
    // show $3k burn instead of $4k → +$12k phantom net worth at month 12.
    assert.equal(buggy - fixed, 12000);
  });

  it("leaves income-only shocks with zero crisisMonthlyAddon", () => {
    const stress = simulateRiskBucket(baseProfile(), {
      events: [{
        id: "i1",
        type: "income_shock",
        name: "Job Loss",
        severity: 100,
        duration: 3,
        isActive: true,
      }],
    });
    assert.equal(stress.crisisMonthlyAddon, 0);
  });
});
