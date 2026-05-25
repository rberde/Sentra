type DriftBucket = "fixedExpenses" | "variableExpenses" | "investments";
type SpendingReallocation = { variableExpenses?: number };
type DriftReallocation = Partial<Record<DriftBucket, number>>;

export interface BudgetDriftCategory {
  name: string;
  actual: number;
  planned: number;
  actualPct: number;
  plannedPct: number;
  driftPct: number;
}

export interface SpendingUsage {
  variableCap: number;
  percentUsed: number;
  thresholdPercent: number;
  alert: boolean;
  alertLevel: "critical" | "warning" | null;
}

const LEGACY_DOLLAR_THRESHOLD_FLOOR = 300;

function safeAmount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function normalizeSpendingThresholdPercent(threshold: number | undefined): number {
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold <= 0) {
    return 100;
  }

  // Older AI-generated spending rules accidentally stored the plan's dollar
  // budget in this percent field, which disables alerts for normal budgets.
  return threshold > LEGACY_DOLLAR_THRESHOLD_FLOOR ? 100 : threshold;
}

export function calculateSpendingUsage(
  actualSpending: number,
  reallocation: SpendingReallocation | undefined,
  threshold: number | undefined,
): SpendingUsage {
  const variableCap = safeAmount(reallocation?.variableExpenses);
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;
  const thresholdPercent = normalizeSpendingThresholdPercent(threshold);
  const alert = variableCap > 0 && percentUsed >= thresholdPercent;

  return {
    variableCap,
    percentUsed,
    thresholdPercent,
    alert,
    alertLevel: alert ? (percentUsed >= 120 ? "critical" : "warning") : null,
  };
}

export function calculateBudgetDriftCategories(
  income: number,
  actuals: Record<DriftBucket, number>,
  reallocation: DriftReallocation | undefined,
  names: Record<DriftBucket, string> = {
    fixedExpenses: "Fixed Expenses",
    variableExpenses: "Variable Expenses",
    investments: "Investments",
  },
): BudgetDriftCategory[] {
  const toIncomePct = (amount: number) => income > 0 ? (amount / income) * 100 : 0;

  return (["fixedExpenses", "variableExpenses", "investments"] as DriftBucket[]).map(key => {
    const actual = safeAmount(actuals[key]);
    const planned = safeAmount(reallocation?.[key]);
    const actualPct = toIncomePct(actual);
    const plannedPct = toIncomePct(planned);

    return {
      name: names[key],
      actual,
      planned,
      actualPct: Math.round(actualPct),
      plannedPct: Math.round(plannedPct),
      driftPct: Math.round(Math.abs(actualPct - plannedPct)),
    };
  });
}
