import type {
  UserProfile,
  GoalWeights,
  AllocationBuckets,
} from "@/lib/types";

const STORAGE_KEY = "pfre_state";

export interface AppState {
  profile: UserProfile | null;
  riskEvents: import("@/lib/types").RiskEvent[];
  stressResult: import("@/lib/types").StressResult | null;
  rebalancingPlans: import("@/lib/types").RebalancingPlan[];
  selectedPlanId: string | null;
  notifications: import("@/lib/types").Notification[];
  behavioralProfile: import("@/lib/types").BehavioralProfile;
  onboardingComplete: boolean;
  plaidAccounts: import("@/lib/types").PlaidAccount[];
  plaidAccessToken: string | null;
}

function defaultState(): AppState {
  return {
    profile: null,
    riskEvents: [],
    stressResult: null,
    rebalancingPlans: [],
    selectedPlanId: null,
    notifications: [],
    behavioralProfile: {
      planSelections: [],
      overrideCount: 0,
    },
    onboardingComplete: false,
    plaidAccounts: [],
    plaidAccessToken: null,
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // Migration: if old schema had investment allocation object, reset to fresh state
    if (parsed.profile?.investments?.allocation) {
      localStorage.removeItem(STORAGE_KEY);
      return defaultState();
    }
    // Ensure new fields exist
    if (parsed.plaidAccounts === undefined) parsed.plaidAccounts = [];
    if (parsed.plaidAccessToken === undefined) parsed.plaidAccessToken = null;
    return parsed as AppState;
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createDefaultProfile(): UserProfile {
  return {
    id: crypto.randomUUID(),
    name: "",
    monthlyIncome: 0,
    incomeStreams: [],
    fixedExpenses: [],
    variableExpenses: [],
    investments: {
      totalValue: 0,
      monthlyContribution: 0,
    },
    savingsGoal: null,
    cashBuffer: 0,
    allocation: {
      fixedExpenses: 40,
      variableExpenses: 20,
      investments: 15,
      savingsGoal: 15,
      cashBuffer: 10,
    },
    goalWeights: {
      lifestyle: 5,
      savingsGoal: 5,
      investmentDiscipline: 5,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function suggestAllocation(
  monthlyIncome: number,
  fixedExpensesTotal: number,
  goalWeights: GoalWeights,
  hasSavingsGoal: boolean,
): AllocationBuckets {
  if (monthlyIncome === 0) {
    return { fixedExpenses: 40, variableExpenses: 20, investments: 15, savingsGoal: hasSavingsGoal ? 15 : 0, cashBuffer: hasSavingsGoal ? 10 : 25 };
  }

  const fixedPct = Math.round((fixedExpensesTotal / monthlyIncome) * 100);
  const remaining = 100 - fixedPct;
  const total = goalWeights.lifestyle + goalWeights.savingsGoal + goalWeights.investmentDiscipline;

  if (total === 0) {
    return { fixedExpenses: fixedPct, variableExpenses: Math.round(remaining * 0.4), investments: Math.round(remaining * 0.2), savingsGoal: hasSavingsGoal ? Math.round(remaining * 0.2) : 0, cashBuffer: Math.round(remaining * (hasSavingsGoal ? 0.2 : 0.4)) };
  }

  const lw = goalWeights.lifestyle / total;
  const sw = hasSavingsGoal ? goalWeights.savingsGoal / total : 0;
  const iw = goalWeights.investmentDiscipline / total;

  const cashBuffer = Math.max(5, Math.round(remaining * 0.1));
  const afterCash = remaining - cashBuffer;

  return {
    fixedExpenses: fixedPct,
    variableExpenses: Math.round(afterCash * lw * 0.6),
    investments: Math.round(afterCash * iw * 0.7),
    savingsGoal: hasSavingsGoal ? Math.round(afterCash * sw * 0.7) : 0,
    cashBuffer,
  };
}
