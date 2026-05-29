import assert from "node:assert/strict";
import { test } from "node:test";

import { runAgentChecks } from "./agent-checks.ts";

function buildState(ruleThreshold) {
  return {
    profile: {
      id: "profile_1",
      name: "Test User",
      monthlyIncome: 6000,
      incomeStreams: [],
      fixedExpenses: [{ name: "Rent", amount: 2500, category: "housing", type: "fixed" }],
      variableExpenses: [{ name: "Spending", amount: 900, category: "food", type: "variable" }],
      investments: { totalValue: 50000, monthlyContribution: 500 },
      savingsGoal: null,
      cashBuffer: 10000,
      allocation: {
        fixedExpenses: 42,
        variableExpenses: 15,
        investments: 8,
        savingsGoal: 0,
        cashBuffer: 35,
      },
      goalWeights: {
        lifestyle: 5,
        savingsGoal: 5,
        investmentDiscipline: 5,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    riskEvents: [],
    stressResult: null,
    rebalancingPlans: [{
      id: "plan_1",
      type: "maximize_lifestyle",
      name: "Plan",
      description: "Plan",
      monthlyReallocation: {
        fixedExpenses: 2500,
        variableExpenses: 800,
        investments: 500,
        savingsGoal: 0,
        cashBuffer: 0,
      },
      timelineToResolve: 0,
      goalImpact: {
        investmentGoalDelay: 0,
        savingsGoalDelay: 0,
        lifestyleReduction: 0,
      },
      projections: {
        month6: {},
        month12: {},
        month24: {},
      },
      tradeoffSummary: "Plan",
    }],
    selectedPlanId: "plan_1",
    notifications: [],
    behavioralProfile: { planSelections: [], overrideCount: 0 },
    onboardingComplete: true,
    plaidAccounts: [],
    plaidAccessToken: null,
    chatHistory: [],
    notificationSettings: {
      pingWindowStart: "09:00",
      pingWindowEnd: "20:00",
      frequency: "daily_digest",
      channels: { inApp: true, sms: false, push: false },
      rules: [{
        id: "ai_spending_old",
        type: "spending_cap",
        label: "Variable spending over $800/mo",
        description: "Alert if spending exceeds plan budget.",
        enabled: true,
        threshold: ruleThreshold,
        aiGenerated: true,
      }],
    },
  };
}

test("spending checks normalize legacy dollar thresholds to plan-budget percent", () => {
  const notifications = runAgentChecks(buildState(800));

  assert.equal(notifications[0]?.type, "spending_limit");
  assert.match(notifications[0]?.message ?? "", /plan budget of \$800\/mo/);
});
