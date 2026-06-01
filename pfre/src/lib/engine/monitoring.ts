export type MonthlyReallocation = Partial<Record<"fixedExpenses" | "variableExpenses" | "investments", number>>;

export function plannedMonthlyAmount(
  reallocation: MonthlyReallocation | undefined,
  category: keyof MonthlyReallocation,
): number {
  const amount = reallocation?.[category] ?? 0;
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function budgetUsagePercent(actualAmount: number, budgetAmount: number): number {
  return budgetAmount > 0 ? Math.round((actualAmount / budgetAmount) * 100) : 0;
}

export function incomeSharePercent(amount: number, monthlyIncome: number): number {
  return monthlyIncome > 0 ? (amount / monthlyIncome) * 100 : 0;
}

export function allocationDriftPercent(
  actualAmount: number,
  plannedAmount: number,
  monthlyIncome: number,
): number {
  return Math.abs(incomeSharePercent(actualAmount, monthlyIncome) - incomeSharePercent(plannedAmount, monthlyIncome));
}
