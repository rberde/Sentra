export interface SpendingRuleLike {
  threshold?: number;
  aiGenerated?: boolean;
}

export interface ReallocationLike {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
}

export interface DriftCategory {
  name: string;
  actual: number;
  planned: number;
  driftPct: number;
}

export function resolveSpendingThresholdPercent(rule?: SpendingRuleLike | null): number {
  const threshold = Number(rule?.threshold ?? 100);

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return 100;
  }

  // Older AI-generated plan rules stored the dollar budget in `threshold`.
  // The evaluators compare against percent-used, so normalize those saved rules.
  if (rule?.aiGenerated && threshold > 200) {
    return 100;
  }

  return threshold;
}

export function calculateSpendingUsage(
  actualSpending: number,
  plannedVariableBudget: number | undefined,
  rule?: SpendingRuleLike | null,
) {
  const variableCap = Math.max(0, Math.round(Number(plannedVariableBudget ?? 0)));
  const percentUsed = variableCap > 0
    ? Math.round((actualSpending / variableCap) * 100)
    : 0;
  const threshold = resolveSpendingThresholdPercent(rule);

  return {
    variableCap,
    percentUsed,
    threshold,
    alert: variableCap > 0 && percentUsed >= threshold,
  };
}

export function calculateDriftCategories(
  actual: { fixedExpenses: number; variableExpenses: number; investments: number },
  planned: ReallocationLike,
): DriftCategory[] {
  return [
    buildDriftCategory("Fixed Expenses", actual.fixedExpenses, planned.fixedExpenses),
    buildDriftCategory("Variable Expenses", actual.variableExpenses, planned.variableExpenses),
    buildDriftCategory("Investments", actual.investments, planned.investments),
  ];
}

function buildDriftCategory(
  name: string,
  actualValue: number,
  plannedValue: number | undefined,
): DriftCategory {
  const actual = Math.max(0, Math.round(Number(actualValue ?? 0)));
  const planned = Math.max(0, Math.round(Number(plannedValue ?? 0)));
  const driftPct = planned > 0
    ? Math.round((Math.abs(actual - planned) / planned) * 100)
    : actual > 0 ? 100 : 0;

  return { name, actual, planned, driftPct };
}
