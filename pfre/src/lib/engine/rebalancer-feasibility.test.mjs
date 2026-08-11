/**
 * Rebalancer feasibility: per-plan cut caps must not recommend insolvent plans
 * or invent "Resolve In" timelines when a hard-constraint deficit remains.
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rebalancerSrc = readFileSync(join(__dirname, "rebalancer.ts"), "utf8").replace(
  'from "./risk-engine"',
  'from "./risk-engine.ts"',
);
const riskSrc = readFileSync(join(__dirname, "risk-engine.ts"), "utf8");
const tmpRebalancer = join(__dirname, ".rebalancer.feasibility.tmp.ts");
const tmpRisk = join(__dirname, ".risk-engine.feasibility.tmp.ts");
writeFileSync(tmpRebalancer, rebalancerSrc);
writeFileSync(tmpRisk, riskSrc);

const { simulateRiskBucket } = await import(tmpRisk);
const { generateRebalancingPlans } = await import(tmpRebalancer);

function baseProfile(overrides = {}) {
  return {
    id: "u1",
    name: "Test",
    monthlyIncome: 5000,
    incomeStreams: [{ name: "Salary", amount: 5000, type: "fixed" }],
    fixedExpenses: [{ name: "Rent", amount: 2000, category: "housing", type: "fixed" }],
    variableExpenses: [
      { name: "Food", amount: 1500, category: "food", type: "variable" },
      { name: "Fun", amount: 1500, category: "entertainment", type: "variable" },
    ],
    investments: { totalValue: 10000, monthlyContribution: 0 },
    savingsGoal: null,
    cashBuffer: 5000,
    allocation: { fixedExpenses: 40, variableExpenses: 60, investments: 0, savingsGoal: 0, cashBuffer: 0 },
    goalWeights: { lifestyle: 3, savingsGoal: 3, investmentDiscipline: 10 },
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

function expenseGap(plan, income) {
  const r = plan.monthlyReallocation;
  return Math.max(0, r.fixedExpenses + r.variableExpenses - income);
}

test("recommended investment plan closes solvable income-shock gap (no silent 60% residual)", () => {
  const profile = baseProfile();
  const stress = simulateRiskBucket(profile, {
    events: [{ id: "e1", type: "income_shock", name: "Cut", severity: 50, duration: 6, isActive: true }],
  });
  assert.equal(stress.adjustedIncome, 2500);
  assert.equal(stress.adjustedMonthlyBurn - stress.adjustedIncome, 2500);

  const plans = generateRebalancingPlans(profile, stress);
  const recommended = plans.find((p) => p.isRecommended);
  assert.ok(recommended, "expected a recommended plan");
  assert.equal(expenseGap(recommended, stress.adjustedIncome), 0);

  const invest = plans.find((p) => p.type === "maximize_investments");
  assert.equal(expenseGap(invest, stress.adjustedIncome), 0);
  assert.ok(invest.monthlyReallocation.variableExpenses <= 500);
  assert.equal(invest.description.includes("shortfall"), false);

  const survival = plans.find((p) => p.type === "maximize_savings_goal");
  assert.equal(expenseGap(survival, stress.adjustedIncome), 0);
});

test("when investment weight is highest but invest plan would have been short, prefer a feasible plan", () => {
  // Force a case where preferred 60% variable cut cannot cover the gap even after deepen
  // only if soft is small — with deepen, invest becomes feasible when soft >= gap.
  // This asserts weight-based recommend still works when all plans are feasible.
  const profile = baseProfile({
    goalWeights: { lifestyle: 2, savingsGoal: 2, investmentDiscipline: 9 },
  });
  const stress = simulateRiskBucket(profile, {
    events: [{ id: "e1", type: "income_shock", name: "Cut", severity: 50, duration: 6, isActive: true }],
  });
  const plans = generateRebalancingPlans(profile, stress);
  const recommended = plans.find((p) => p.isRecommended);
  assert.equal(recommended.type, "maximize_investments");
  assert.equal(expenseGap(recommended, stress.adjustedIncome), 0);
});

test("hard-constraint deficit uses liquidity runway for Resolve In, not freeable fiction", () => {
  const profile = baseProfile({
    fixedExpenses: [{ name: "Rent", amount: 2200, category: "housing", type: "fixed" }],
    variableExpenses: [{ name: "Food", amount: 1200, category: "food", type: "variable" }],
    investments: { totalValue: 50000, monthlyContribution: 1000 },
    savingsGoal: {
      name: "House",
      targetAmount: 50000,
      targetDate: "2028-01-01",
      currentBalance: 0,
      monthlyContribution: 500,
    },
    cashBuffer: 12000,
    goalWeights: { lifestyle: 10, savingsGoal: 3, investmentDiscipline: 3 },
  });
  const stress = simulateRiskBucket(profile, {
    events: [{ id: "e1", type: "income_shock", name: "Job loss", severity: 100, duration: 6, isActive: true }],
  });
  assert.equal(stress.adjustedIncome, 0);

  const plans = generateRebalancingPlans(profile, stress);
  const lifestyle = plans.find((p) => p.type === "maximize_lifestyle");
  assert.equal(lifestyle.monthlyReallocation.variableExpenses, 0);
  assert.equal(lifestyle.monthlyReallocation.investments, 0);
  assert.equal(expenseGap(lifestyle, 0), 2200);
  // $12k cash / $2200/mo ≈ 5.45 → 6 months (not the old freeable-based 8)
  assert.equal(lifestyle.timelineToResolve, 6);
  assert.ok(lifestyle.description.includes("shortfall"));
});

test("investment plan deepens variable cuts before pausing contributions", () => {
  const profile = baseProfile({
    variableExpenses: [{ name: "Food", amount: 2000, category: "food", type: "variable" }],
    investments: { totalValue: 80000, monthlyContribution: 800 },
    cashBuffer: 8000,
    goalWeights: { lifestyle: 3, savingsGoal: 3, investmentDiscipline: 10 },
  });
  // Income $5k → $2.5k; burn $4k; gap $1.5k. Soft $2k can cover without pausing.
  const stress = simulateRiskBucket(profile, {
    events: [{ id: "e1", type: "income_shock", name: "Cut", severity: 50, duration: 6, isActive: true }],
  });
  assert.equal(stress.adjustedIncome, 2500);
  assert.equal(stress.adjustedMonthlyBurn - stress.adjustedIncome, 1500);

  const plans = generateRebalancingPlans(profile, stress);
  const invest = plans.find((p) => p.type === "maximize_investments");
  assert.equal(expenseGap(invest, stress.adjustedIncome), 0);
  // Prefer cutting variable over pausing the $800 contribution
  assert.equal(invest.monthlyReallocation.investments, 800);
  assert.equal(invest.monthlyReallocation.variableExpenses, 500);
});

test("recommends a gap-closing plan over a higher-weighted pause-only lifestyle plan", () => {
  const profile = baseProfile({
    fixedExpenses: [{ name: "Rent", amount: 2000, category: "housing", type: "fixed" }],
    variableExpenses: [{ name: "Food", amount: 2000, category: "food", type: "variable" }],
    investments: { totalValue: 50000, monthlyContribution: 2000 },
    cashBuffer: 10000,
    // Lifestyle weighted highest, but pause-first lifestyle keeps variable spend and stays short.
    goalWeights: { lifestyle: 10, savingsGoal: 2, investmentDiscipline: 4 },
  });
  const stress = simulateRiskBucket(profile, {
    events: [{ id: "e1", type: "income_shock", name: "Cut", severity: 50, duration: 6, isActive: true }],
  });
  // Income $2.5k, burn $4k, gap $1.5k; pausable $2k covers amountNeeded without variable cuts.
  assert.equal(stress.adjustedIncome, 2500);
  assert.equal(stress.adjustedMonthlyBurn - stress.adjustedIncome, 1500);

  const plans = generateRebalancingPlans(profile, stress);
  const lifestyle = plans.find((p) => p.type === "maximize_lifestyle");
  const invest = plans.find((p) => p.type === "maximize_investments");
  assert.ok(expenseGap(lifestyle, stress.adjustedIncome) > 0, "lifestyle pause-only leaves expense gap");
  assert.equal(expenseGap(invest, stress.adjustedIncome), 0);

  const recommended = plans.find((p) => p.isRecommended);
  assert.equal(recommended.type, "maximize_investments");
  assert.match(recommended.recommendationReason, /closes your monthly budget gap/i);
});

test.after(() => {
  try { unlinkSync(tmpRebalancer); } catch { /* already gone */ }
  try { unlinkSync(tmpRisk); } catch { /* already gone */ }
});
