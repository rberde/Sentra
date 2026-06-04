type ReallocationLike = {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
};

export interface SpendingUsage {
  variableCap: number;
  actualSpending: number;
  percentUsed: number;
  threshold: number;
  alert: boolean;
}

export interface DriftCategory {
  name: string;
  actual: number;
  planned: number;
  actualPct: number;
  plannedPct: number;
  driftPct: number;
}

export function calculateSpendingUsage(
  actualSpending: number,
  reallocation: ReallocationLike | undefined,
  threshold: number = 100,
): SpendingUsage {
  const variableCap = Math.round(reallocation?.variableExpenses ?? 0);
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;
  const thresholdCap = variableCap * (threshold / 100);

  return {
    variableCap,
    actualSpending,
    percentUsed,
    threshold,
    alert: variableCap > 0 && actualSpending > thresholdCap,
  };
}

export function calculateAllocationDrift(params: {
  income: number;
  actualFixed: number;
  actualVariable: number;
  actualInvestment: number;
  reallocation: ReallocationLike | undefined;
}): DriftCategory[] {
  const { income, actualFixed, actualVariable, actualInvestment, reallocation } = params;

  const toPct = (amount: number) => income > 0 ? (amount / income) * 100 : 0;
  const roundPct = (value: number) => Math.round(value);

  const categories = [
    { name: "Fixed Expenses", actual: actualFixed, planned: reallocation?.fixedExpenses ?? 0 },
    { name: "Variable Expenses", actual: actualVariable, planned: reallocation?.variableExpenses ?? 0 },
    { name: "Investments", actual: actualInvestment, planned: reallocation?.investments ?? 0 },
  ];

  return categories.map(category => {
    const actualPct = roundPct(toPct(category.actual));
    const plannedPct = roundPct(toPct(category.planned));

    return {
      ...category,
      actual: Math.round(category.actual),
      planned: Math.round(category.planned),
      actualPct,
      plannedPct,
      driftPct: Math.abs(actualPct - plannedPct),
    };
  });
}
