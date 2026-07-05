export interface MonthlyReallocation {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
}

export function calculateSpendingUsage(
  actualSpending: number,
  reallocation: MonthlyReallocation | undefined,
) {
  const variableCap = Math.round(reallocation?.variableExpenses ?? 0);
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;

  return { variableCap, percentUsed };
}

export function calculatePercentDriftCategories({
  income,
  totalFixed,
  totalVariable,
  monthlyInvestment,
  reallocation,
}: {
  income: number;
  totalFixed: number;
  totalVariable: number;
  monthlyInvestment: number;
  reallocation: MonthlyReallocation;
}) {
  const asIncomePct = (amount: number) => income > 0 ? Math.round((amount / income) * 100) : 0;

  const categories = [
    { name: "Fixed", actual: asIncomePct(totalFixed), planned: asIncomePct(reallocation.fixedExpenses ?? 0) },
    { name: "Variable", actual: asIncomePct(totalVariable), planned: asIncomePct(reallocation.variableExpenses ?? 0) },
    { name: "Investments", actual: asIncomePct(monthlyInvestment), planned: asIncomePct(reallocation.investments ?? 0) },
  ];

  return categories.map(category => ({
    ...category,
    drift: Math.abs(category.actual - category.planned),
  }));
}

export function calculateDollarDriftCategories({
  actualFixed,
  actualVariable,
  actualInvestment,
  reallocation,
}: {
  actualFixed: number;
  actualVariable: number;
  actualInvestment: number;
  reallocation: MonthlyReallocation | undefined;
}) {
  const categories = [
    { name: "Fixed Expenses", actual: actualFixed, planned: Math.round(reallocation?.fixedExpenses ?? 0) },
    { name: "Variable Expenses", actual: actualVariable, planned: Math.round(reallocation?.variableExpenses ?? 0) },
    { name: "Investments", actual: actualInvestment, planned: Math.round(reallocation?.investments ?? 0) },
  ];

  return categories.map(category => ({
    ...category,
    driftPct: category.planned > 0
      ? Math.round((Math.abs(category.actual - category.planned) / category.planned) * 100)
      : 0,
  }));
}
