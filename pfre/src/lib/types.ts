// ── Financial Primitives ──

export interface IncomeStream {
  name: string;
  amount: number; // monthly $
  type: "fixed" | "variable";
}

export interface Expense {
  name: string;
  amount: number; // monthly $
  category: "housing" | "transport" | "food" | "insurance" | "loans" | "subscriptions" | "entertainment" | "shopping" | "other";
  type: "fixed" | "variable";
}

export interface InvestmentPortfolio {
  totalValue: number;
  monthlyContribution: number;
}

export interface SavingsGoal {
  name: string;
  targetAmount: number;
  targetDate: string; // ISO date
  currentBalance: number;
  monthlyContribution: number;
  linkedAccountIds?: string[]; // Plaid account IDs that fund this goal
}

// ── Allocation Buckets ──

export interface AllocationBuckets {
  fixedExpenses: number;     // % of income
  variableExpenses: number;  // % of income
  investments: number;       // % of income
  savingsGoal: number;       // % of income
  cashBuffer: number;        // % of income
}

// ── Goal Weights ──

export interface GoalWeights {
  lifestyle: number;           // 1-10
  savingsGoal: number;         // 1-10
  investmentDiscipline: number; // 1-10
}

export interface NormalizedWeights {
  lifestyle: number;           // 0-1, sums to 1
  savingsGoal: number;
  investmentDiscipline: number;
}

// ── User Profile ──

export interface UserProfile {
  id: string;
  name: string;
  monthlyIncome: number;
  incomeStreams: IncomeStream[];
  fixedExpenses: Expense[];
  variableExpenses: Expense[];
  investments: InvestmentPortfolio;
  savingsGoal: SavingsGoal | null;
  cashBuffer: number;
  allocation: AllocationBuckets;
  goalWeights: GoalWeights;
  createdAt: string;
  updatedAt: string;
}

// ── Plaid ──

export interface PlaidAccount {
  accountId: string;
  name: string;
  type: "checking" | "savings" | "investment" | "credit" | "other";
  balance: number;
  institution: string;
}

// ── Risk Buckets ──

export type RiskBucketType = "income_shock" | "expense_shock" | "market_shock" | "structural_drift";

export interface RiskEvent {
  id: string;
  type: RiskBucketType;
  name: string;
  severity: number;     // 0-100 (percentage or dollar amount depending on type)
  duration: number;     // months, -1 for unknown
  lumpSum?: number;     // one-time expense amount (for expense_shock)
  description?: string; // plain-language description of the event
  aiSuggested?: boolean;
  isActive: boolean;
}

export interface CompoundRiskScenario {
  events: RiskEvent[];
}

// ── Stress Results ──

export interface ConstraintMap {
  hardConstraints: number;    // $ cannot touch (fixed expenses)
  softConstraints: number;    // $ can reduce (variable expenses)
  pausable: number;           // $ can pause (investment contributions)
  redirectable: number;       // $ can redirect (savings goal contributions)
  availableLiquidity: number; // $ cash buffer + accessible savings
}

export interface StressResult {
  baselineMonthlyBurn: number;
  adjustedMonthlyBurn: number;
  adjustedIncome: number;         // income after shocks (may be 0 for full job loss)
  liquidityRunway: number;        // months
  portfolioStressValue: number;
  riskScoreBefore: number;        // 0-100
  riskScoreAfter: number;         // 0-100
  riskScoreDelta: number;
  constraintMap: ConstraintMap;
  depletionTimeline: MonthProjection[];
  additionalExpense: number;      // total lump sum / added expenses
  crisisDurationMonths: number;   // effective planning horizon (unknown → 6)
}

export interface MonthProjection {
  month: number;
  cashBuffer: number;
  savingsBalance: number;
  investmentValue: number;
  cumulativeExpenses: number;
  netPosition: number;
}

// ── Rebalancing Plans ──

export type PlanType = "maximize_lifestyle" | "maximize_investments" | "maximize_savings_goal";

export interface BucketReallocation {
  fixedExpenses: number;
  variableExpenses: number;
  investments: number;
  savingsGoal: number;
  cashBuffer: number;
}

export interface RebalancingPlan {
  id: string;
  type: PlanType;
  name: string;
  description: string;
  monthlyReallocation: BucketReallocation;
  timelineToResolve: number;
  goalImpact: {
    investmentGoalDelay: number;
    savingsGoalDelay: number;
    lifestyleReduction: number;
  };
  projections: {
    month6: MonthProjection;
    month12: MonthProjection;
    month24: MonthProjection;
  };
  tradeoffSummary: string;
  isRecommended?: boolean;
  recommendationReason?: string;
}

// ── Notifications ──

export type NotificationType =
  | "spending_limit"
  | "liquidity_warning"
  | "reallocation_opportunity"
  | "drift_alert"
  | "scheduled_checkin";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: "info" | "warning" | "urgent";
  isDismissed: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface NotificationRule {
  id: string;
  type: "spending_cap" | "liquidity_floor" | "drift_threshold" | "scheduled_checkin" | "risk_score_alert";
  label: string;
  description: string;
  enabled: boolean;
  threshold?: number;
  intervalDays?: number;
  aiGenerated?: boolean;
}

export interface NotificationSettings {
  pingWindowStart: string; // "HH:mm"
  pingWindowEnd: string;   // "HH:mm"
  frequency: "realtime" | "daily_digest" | "weekly_digest";
  channels: {
    inApp: boolean;
    sms: boolean;
    push: boolean;
  };
  rules: NotificationRule[];
}

// ── Chat ──

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// ── Behavioral Profile ──

export type RiskArchetype =
  | "conservative_protector"
  | "balanced_pragmatist"
  | "optimistic_continuity"
  | "aggressive_growth";

export interface BehavioralProfile {
  planSelections: { planType: PlanType; date: string }[];
  overrideCount: number;
  archetype?: RiskArchetype;
  suggestedWeightAdjustment?: Partial<GoalWeights>;
}
