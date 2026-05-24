export type PlanAmountKey = "fixedExpenses" | "variableExpenses" | "investments";

export interface PlanAmounts {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
}

export interface AllocationActuals {
  fixedExpenses: number;
  variableExpenses: number;
  investments: number;
}

export interface AllocationDriftCategory {
  name: string;
  actual: number;
  planned: number;
  driftPct: number;
}

export function getMonthlyPlanAmount(
  reallocation: PlanAmounts | undefined,
  key: PlanAmountKey,
): number {
  const value = reallocation?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

export function calculateUsagePercent(actual: number, planned: number): number {
  return planned > 0 ? Math.round((actual / planned) * 100) : 0;
}

export function buildAllocationDriftCategories(
  actuals: AllocationActuals,
  reallocation: PlanAmounts | undefined,
): AllocationDriftCategory[] {
  const categories = [
    {
      name: "Fixed Expenses",
      actual: actuals.fixedExpenses,
      planned: getMonthlyPlanAmount(reallocation, "fixedExpenses"),
    },
    {
      name: "Variable Expenses",
      actual: actuals.variableExpenses,
      planned: getMonthlyPlanAmount(reallocation, "variableExpenses"),
    },
    {
      name: "Investments",
      actual: actuals.investments,
      planned: getMonthlyPlanAmount(reallocation, "investments"),
    },
  ];

  return categories.map(category => ({
    ...category,
    driftPct: category.planned > 0
      ? Math.round((Math.abs(category.actual - category.planned) / category.planned) * 100)
      : 0,
  }));
}

export function getMaxDriftPct(categories: AllocationDriftCategory[]): number {
  return categories.length > 0 ? Math.max(...categories.map(category => category.driftPct)) : 0;
}
