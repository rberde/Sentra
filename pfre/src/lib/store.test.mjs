import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  constructor(initial) {
    this.values = new Map(Object.entries(initial));
    this.removedKeys = [];
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.removedKeys.push(key);
    this.values.delete(key);
  }
}

test("loadState migrates legacy investment allocation without deleting saved data", async () => {
  const legacyAllocation = {
    fixedExpenses: 45,
    variableExpenses: 20,
    investments: 15,
    savingsGoal: 10,
    cashBuffer: 10,
  };
  const savedState = {
    profile: {
      id: "profile-1",
      name: "Legacy User",
      monthlyIncome: 5000,
      incomeStreams: [],
      fixedExpenses: [{ name: "Rent", amount: 1800, category: "housing", type: "fixed" }],
      variableExpenses: [{ name: "Groceries", amount: 600, category: "food", type: "variable" }],
      investments: {
        totalValue: 25000,
        monthlyContribution: 500,
        allocation: legacyAllocation,
      },
      savingsGoal: null,
      cashBuffer: 7000,
      goalWeights: { lifestyle: 5, savingsGoal: 5, investmentDiscipline: 5 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    riskEvents: [],
    stressResult: null,
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
    const { loadState } = await import(`./store.ts?store=${Date.now()}`);
    const loaded = loadState();

    assert.equal(storage.removedKeys.length, 0);
    assert.equal(loaded.profile?.name, "Legacy User");
    assert.equal(loaded.onboardingComplete, true);
    assert.deepEqual(loaded.profile?.allocation, legacyAllocation);
    assert.equal("allocation" in loaded.profile.investments, false);
    assert.deepEqual(loaded.plaidAccounts, []);
    assert.equal(loaded.plaidAccessToken, null);
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
