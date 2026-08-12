/**
 * Spending-cap alerts must fire when a crisis plan sets variable budget to $0.
 * Regression: checkSpendingCap used to early-return on planBudget <= 0.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSpendingCapUsage,
  evaluateSpendingCapBreach,
  formatSpendingCapMessage,
} from "./spending-cap.ts";

test("zero plan budget alerts urgently on any positive variable spend", () => {
  const breach = evaluateSpendingCapBreach({
    planBudget: 0,
    actualSpending: 1200,
    thresholdPct: 100,
  });

  assert.deepEqual(breach, { overByPct: null, severity: "urgent" });
  assert.match(
    formatSpendingCapMessage(1200, 0, breach),
    /plan budget of \$0\/mo/,
  );
});

test("zero plan budget stays quiet when actual spend is also zero", () => {
  assert.equal(
    evaluateSpendingCapBreach({ planBudget: 0, actualSpending: 0 }),
    null,
  );
});

test("positive plan budget still alerts when spend exceeds threshold", () => {
  const breach = evaluateSpendingCapBreach({
    planBudget: 1000,
    actualSpending: 1600,
    thresholdPct: 100,
  });

  assert.deepEqual(breach, { overByPct: 60, severity: "urgent" });
});

test("positive plan budget respects threshold headroom", () => {
  assert.equal(
    evaluateSpendingCapBreach({
      planBudget: 1000,
      actualSpending: 1050,
      thresholdPct: 110,
    }),
    null,
  );
});

test("server usage helper alerts on $0 cap without divide-by-zero", () => {
  assert.deepEqual(
    calculateSpendingCapUsage({
      planBudget: 0,
      actualSpending: 800,
      thresholdPct: 100,
    }),
    { variableCap: 0, percentUsed: 100, alert: true },
  );

  assert.deepEqual(
    calculateSpendingCapUsage({
      planBudget: 0,
      actualSpending: 0,
      thresholdPct: 100,
    }),
    { variableCap: 0, percentUsed: 0, alert: false },
  );

  assert.deepEqual(
    calculateSpendingCapUsage({
      planBudget: 2000,
      actualSpending: 2500,
      thresholdPct: 100,
    }),
    { variableCap: 2000, percentUsed: 125, alert: true },
  );
});

test("full income shock lifestyle plan zeros variable budget and breaches on current spend", async () => {
  const { readFileSync, writeFileSync, unlinkSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const rebalancerSrc = readFileSync(join(__dirname, "rebalancer.ts"), "utf8").replace(
    'from "./risk-engine"',
    'from "./risk-engine.ts"',
  );
  const riskSrc = readFileSync(join(__dirname, "risk-engine.ts"), "utf8");
  const tmpRebalancer = join(__dirname, ".rebalancer.spending-cap.tmp.ts");
  const tmpRisk = join(__dirname, ".risk-engine.spending-cap.tmp.ts");
  writeFileSync(tmpRebalancer, rebalancerSrc);
  writeFileSync(tmpRisk, riskSrc);

  try {
    const { simulateRiskBucket } = await import(tmpRisk);
    const { generateRebalancingPlans } = await import(tmpRebalancer);

    const profile = {
      id: "u1",
      name: "Test",
      monthlyIncome: 5000,
      incomeStreams: [{ name: "Salary", amount: 5000, type: "fixed" }],
      fixedExpenses: [{ name: "Rent", amount: 2000, category: "housing", type: "fixed" }],
      variableExpenses: [
        { name: "Food", amount: 800, category: "food", type: "variable" },
        { name: "Fun", amount: 400, category: "entertainment", type: "variable" },
      ],
      investments: { totalValue: 10000, monthlyContribution: 500 },
      savingsGoal: null,
      cashBuffer: 5000,
      allocation: { fixedExpenses: 40, variableExpenses: 24, investments: 10, savingsGoal: 0, cashBuffer: 26 },
      goalWeights: { lifestyle: 10, savingsGoal: 3, investmentDiscipline: 3 },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };

    const stress = simulateRiskBucket(profile, {
      events: [{ id: "e1", type: "income_shock", name: "Job loss", severity: 100, duration: 6, isActive: true }],
    });
    const lifestyle = generateRebalancingPlans(profile, stress)
      .find((p) => p.type === "maximize_lifestyle");

    assert.equal(lifestyle.monthlyReallocation.variableExpenses, 0);
    assert.deepEqual(
      evaluateSpendingCapBreach({
        planBudget: lifestyle.monthlyReallocation.variableExpenses,
        actualSpending: 1200,
        thresholdPct: 100,
      }),
      { overByPct: null, severity: "urgent" },
    );
  } finally {
    unlinkSync(tmpRebalancer);
    unlinkSync(tmpRisk);
  }
});
