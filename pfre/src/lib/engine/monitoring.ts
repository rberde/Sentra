export interface SpendingUsage {
  variableCap: number;
  percentUsed: number;
  alert: boolean;
}

export interface DriftCategory {
  key: "fixedExpenses" | "variableExpenses" | "investments";
  name: string;
  actual: number;
  planned: number;
  actualPct: number;
  plannedPct: number;
  driftPct: number;
}

interface BudgetReallocation {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
}

interface ActualBudgetAmounts {
  fixedExpenses: number;
  variableExpenses: number;
  investments: number;
}

function roundedPercentage(amount: number, income: number): number {
  if (income <= 0) return 0;
  return Math.round((amount / income) * 100);
}

export function calculateSpendingUsage(
  actualSpending: number,
  reallocation: BudgetReallocation,
  thresholdPct = 100,
): SpendingUsage {
  const variableCap = Math.round(reallocation.variableExpenses ?? 0);
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;
  const alert = variableCap > 0 && actualSpending > variableCap * (thresholdPct / 100);

  return { variableCap, percentUsed, alert };
}

export function calculateBudgetDrift(
  income: number,
  actuals: ActualBudgetAmounts,
  reallocation: BudgetReallocation,
): { categories: DriftCategory[]; overallDrift: number } {
  const categories: DriftCategory[] = [
    {
      key: "fixedExpenses",
      name: "Fixed Expenses",
      actual: Math.round(actuals.fixedExpenses),
      planned: Math.round(reallocation.fixedExpenses ?? 0),
      actualPct: roundedPercentage(actuals.fixedExpenses, income),
      plannedPct: roundedPercentage(reallocation.fixedExpenses ?? 0, income),
      driftPct: 0,
    },
    {
      key: "variableExpenses",
      name: "Variable Expenses",
      actual: Math.round(actuals.variableExpenses),
      planned: Math.round(reallocation.variableExpenses ?? 0),
      actualPct: roundedPercentage(actuals.variableExpenses, income),
      plannedPct: roundedPercentage(reallocation.variableExpenses ?? 0, income),
      driftPct: 0,
    },
    {
      key: "investments",
      name: "Investments",
      actual: Math.round(actuals.investments),
      planned: Math.round(reallocation.investments ?? 0),
      actualPct: roundedPercentage(actuals.investments, income),
      plannedPct: roundedPercentage(reallocation.investments ?? 0, income),
      driftPct: 0,
    },
  ].map(category => ({
    ...category,
    driftPct: Math.abs(category.actualPct - category.plannedPct),
  }));

  return {
    categories,
    overallDrift: Math.max(...categories.map(category => category.driftPct)),
  };
}
