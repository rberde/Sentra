export interface SpendingRuleInput {
  threshold?: unknown;
  thresholdUnit?: unknown;
  aiGenerated?: unknown;
}

export interface SpendingEvaluation {
  variableCap: number;
  thresholdAmount: number;
  thresholdPercent: number;
  percentUsed: number;
  alert: boolean;
}

export interface AllocationAmounts {
  fixedExpenses: number;
  variableExpenses: number;
  investments: number;
}

export interface DriftCategory {
  key: keyof AllocationAmounts;
  name: string;
  actual: number;
  planned: number;
  driftPct: number;
}

export interface DriftEvaluation {
  categories: DriftCategory[];
  overallDrift: number;
  threshold: number;
  alert: boolean;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolveSpendingThreshold(rule: SpendingRuleInput | undefined, variableCap: number) {
  const threshold = finiteNumber(rule?.threshold, 100);
  const unit = rule?.thresholdUnit === "percent" || rule?.thresholdUnit === "amount"
    ? rule.thresholdUnit
    : undefined;
  const legacyAiDollarThreshold = unit === undefined && rule?.aiGenerated === true && threshold !== 100;
  const isDollarAmount = unit === "amount" || legacyAiDollarThreshold;

  if (isDollarAmount) {
    return {
      thresholdAmount: threshold,
      thresholdPercent: variableCap > 0 ? Math.round((threshold / variableCap) * 100) : 0,
    };
  }

  return {
    thresholdAmount: Math.round(variableCap * (threshold / 100)),
    thresholdPercent: threshold,
  };
}

export function evaluateSpending(
  actualSpending: number,
  variableBudget: number,
  rule?: SpendingRuleInput,
): SpendingEvaluation {
  const variableCap = Math.round(finiteNumber(variableBudget));
  const actual = finiteNumber(actualSpending);
  const { thresholdAmount, thresholdPercent } = resolveSpendingThreshold(rule, variableCap);
  const percentUsed = variableCap > 0 ? Math.round((actual / variableCap) * 100) : 0;

  return {
    variableCap,
    thresholdAmount,
    thresholdPercent,
    percentUsed,
    alert: thresholdAmount > 0 && actual >= thresholdAmount,
  };
}

function driftPercent(actual: number, planned: number): number {
  if (planned <= 0) return actual > 0 ? 100 : 0;
  return Math.round((Math.abs(actual - planned) / planned) * 100);
}

export function evaluateAllocationDrift(
  actual: AllocationAmounts,
  planned: AllocationAmounts,
  threshold = 10,
): DriftEvaluation {
  const baseCategories: Array<Omit<DriftCategory, "driftPct">> = [
    {
      key: "fixedExpenses",
      name: "Fixed Expenses",
      actual: Math.round(finiteNumber(actual.fixedExpenses)),
      planned: Math.round(finiteNumber(planned.fixedExpenses)),
    },
    {
      key: "variableExpenses",
      name: "Variable Expenses",
      actual: Math.round(finiteNumber(actual.variableExpenses)),
      planned: Math.round(finiteNumber(planned.variableExpenses)),
    },
    {
      key: "investments",
      name: "Investments",
      actual: Math.round(finiteNumber(actual.investments)),
      planned: Math.round(finiteNumber(planned.investments)),
    },
  ];

  const categories: DriftCategory[] = baseCategories.map(category => ({
    ...category,
    driftPct: driftPercent(category.actual, category.planned),
  }));

  const overallDrift = Math.max(0, ...categories.map(category => category.driftPct));

  return {
    categories,
    overallDrift,
    threshold,
    alert: overallDrift > threshold,
  };
}
