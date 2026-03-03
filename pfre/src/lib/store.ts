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
  chatHistory: import("@/lib/types").ChatMessage[];
  notificationSettings: import("@/lib/types").NotificationSettings;
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
    chatHistory: [],
    notificationSettings: {
      pingWindowStart: "09:00",
      pingWindowEnd: "20:00",
      frequency: "daily_digest",
      channels: {
        inApp: true,
        sms: false,
        push: false,
      },
      rules: [
        { id: "rule_spending_cap", type: "spending_cap", label: "Variable spending exceeds plan budget", description: "Alert when variable spending crosses the monthly limit set by your active plan.", enabled: true, threshold: 100, aiGenerated: false },
        { id: "rule_liquidity_floor", type: "liquidity_floor", label: "Cash drops below 2 months of expenses", description: "Alert when your cash balance can cover fewer than this many months of fixed expenses.", enabled: true, threshold: 2, aiGenerated: false },
        { id: "rule_risk_score", type: "risk_score_alert", label: "Risk score exceeds safe zone", description: "Alert when your composite risk score rises above this value (0–100, lower is better).", enabled: true, threshold: 60, aiGenerated: false },
        { id: "rule_drift", type: "drift_threshold", label: "Allocation drifts from plan by more than 10%", description: "Alert when any budget category drifts more than this percentage from your planned allocation.", enabled: true, threshold: 10, aiGenerated: false },
        { id: "rule_checkin", type: "scheduled_checkin", label: "Monthly progress check-in", description: "The AI agent sends a summary and nudge at this interval.", enabled: true, intervalDays: 30, aiGenerated: false },
      ],
    },
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
    if (parsed.chatHistory === undefined) parsed.chatHistory = [];
    if (parsed.notificationSettings === undefined) {
      parsed.notificationSettings = defaultState().notificationSettings;
    }
    if (parsed.notificationSettings && parsed.notificationSettings.rules === undefined) {
      parsed.notificationSettings.rules = defaultState().notificationSettings.rules;
    }
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

  const fixedPct = Math.min(80, Math.round((fixedExpensesTotal / monthlyIncome) * 100));
  const remaining = 100 - fixedPct;
  const total = goalWeights.lifestyle + goalWeights.savingsGoal + goalWeights.investmentDiscipline;

  let variableExpenses: number;
  let investments: number;
  let savingsGoal: number;
  let cashBuffer: number;

  if (total === 0) {
    variableExpenses = Math.round(remaining * 0.4);
    investments = Math.round(remaining * 0.2);
    savingsGoal = hasSavingsGoal ? Math.round(remaining * 0.2) : 0;
    cashBuffer = remaining - variableExpenses - investments - savingsGoal;
  } else {
    const lw = goalWeights.lifestyle / total;
    const sw = hasSavingsGoal ? goalWeights.savingsGoal / total : 0;
    const iw = goalWeights.investmentDiscipline / total;

    cashBuffer = Math.max(5, Math.round(remaining * 0.1));
    const afterCash = remaining - cashBuffer;

    variableExpenses = Math.round(afterCash * lw * 0.6);
    investments = Math.round(afterCash * iw * 0.7);
    savingsGoal = hasSavingsGoal ? Math.round(afterCash * sw * 0.7) : 0;

    // Ensure total sums to exactly 100 — absorb rounding errors into cashBuffer
    const subtotal = fixedPct + variableExpenses + investments + savingsGoal + cashBuffer;
    cashBuffer += 100 - subtotal;
    if (cashBuffer < 0) {
      variableExpenses += cashBuffer;
      cashBuffer = 0;
    }
  }

  return {
    fixedExpenses: fixedPct,
    variableExpenses: Math.max(0, variableExpenses),
    investments: Math.max(0, investments),
    savingsGoal: Math.max(0, savingsGoal),
    cashBuffer: Math.max(0, cashBuffer),
  };
}
