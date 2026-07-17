import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  constructor(initial) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("loadState migrates stress results saved before required planning fields existed", async () => {
  const savedState = {
    profile: {
      id: "profile-1",
      name: "Saved User",
      monthlyIncome: 5000,
      incomeStreams: [],
      fixedExpenses: [],
      variableExpenses: [],
      investments: { totalValue: 0, monthlyContribution: 0 },
      savingsGoal: null,
      cashBuffer: 5000,
      allocation: {
        fixedExpenses: 40,
        variableExpenses: 20,
        investments: 15,
        savingsGoal: 15,
        cashBuffer: 10,
      },
      goalWeights: { lifestyle: 5, savingsGoal: 5, investmentDiscipline: 5 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    riskEvents: [{
      id: "risk-1",
      type: "income_shock",
      name: "Reduced hours",
      severity: 40,
      duration: 9,
      isActive: true,
    }],
    stressResult: {
      baselineMonthlyBurn: 4000,
      adjustedMonthlyBurn: 4500,
      liquidityRunway: 3.3,
      portfolioStressValue: 0,
      riskScoreBefore: 50,
      riskScoreAfter: 75,
      riskScoreDelta: 25,
      constraintMap: {
        hardConstraints: 3000,
        softConstraints: 1000,
        pausable: 0,
        redirectable: 0,
        availableLiquidity: 5000,
      },
      depletionTimeline: [],
      additionalExpense: 0,
    },
    rebalancingPlans: [],
    selectedPlanId: null,
    notifications: [],
    behavioralProfile: { planSelections: [], overrideCount: 0 },
    onboardingComplete: true,
  };
  const storage = new MemoryStorage({
    pfre_state: JSON.stringify(savedState),
  });
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  globalThis.window = { localStorage: storage };
  globalThis.localStorage = storage;

  try {
    const { loadState } = await import(`./store.ts?stress-migration=${Date.now()}`);
    const loaded = loadState();

    assert.equal(loaded.stressResult.adjustedIncome, 3000);
    assert.equal(loaded.stressResult.crisisDurationMonths, 9);
    assert.equal(
      Math.max(0, loaded.stressResult.adjustedMonthlyBurn - loaded.stressResult.adjustedIncome),
      1500,
    );
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalLocalStorage;
    }
  }
});
