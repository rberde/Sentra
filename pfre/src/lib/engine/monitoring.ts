type ReallocationLike = {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
};

export interface SpendingUsage {
  variableCap: number;
  percentUsed: number;
}

export interface DriftCategory {
  name: string;
  actual: number;
  planned: number;
  driftPct: number;
}

function monthlyAmount(value: number | undefined): number {
  return Math.max(0, Math.round(value ?? 0));
}

export function calculateSpendingUsage(actualSpending: number, reallocation: ReallocationLike | undefined): SpendingUsage {
  const variableCap = monthlyAmount(reallocation?.variableExpenses);
  return {
    variableCap,
    percentUsed: variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0,
  };
}

export function calculateDriftCategories(
  actual: { fixedExpenses: number; variableExpenses: number; investments: number },
  reallocation: ReallocationLike | undefined,
): DriftCategory[] {
  const categories = [
    { name: "Fixed Expenses", actual: actual.fixedExpenses, planned: monthlyAmount(reallocation?.fixedExpenses) },
    { name: "Variable Expenses", actual: actual.variableExpenses, planned: monthlyAmount(reallocation?.variableExpenses) },
    { name: "Investments", actual: actual.investments, planned: monthlyAmount(reallocation?.investments) },
  ];

  return categories.map(category => ({
    ...category,
    driftPct: category.planned > 0
      ? Math.round((Math.abs(category.actual - category.planned) / category.planned) * 100)
      : 0,
  }));
}
