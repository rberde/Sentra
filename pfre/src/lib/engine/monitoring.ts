export interface MonthlyReallocation {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
}

export interface DollarDriftCategory {
  name: string;
  actual: number;
  planned: number;
  driftPct: number;
}

export interface IncomePercentDriftCategory {
  name: string;
  actual: number;
  planned: number;
  drift: number;
}

function monthlyDollars(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function incomePercent(amount: number, income: number): number {
  return income > 0 ? Math.round((amount / income) * 100) : 0;
}

export function getVariableSpendingCap(reallocation: MonthlyReallocation | undefined): number {
  return monthlyDollars(reallocation?.variableExpenses);
}

export function getPercentUsed(actual: number, cap: number): number {
  return cap > 0 ? Math.round((actual / cap) * 100) : 0;
}

export function getDollarDriftCategories(input: {
  actualFixed: number;
  actualVariable: number;
  actualInvestment: number;
  reallocation: MonthlyReallocation | undefined;
}): DollarDriftCategory[] {
  const categories = [
    { name: "Fixed Expenses", actual: input.actualFixed, planned: monthlyDollars(input.reallocation?.fixedExpenses) },
    { name: "Variable Expenses", actual: input.actualVariable, planned: monthlyDollars(input.reallocation?.variableExpenses) },
    { name: "Investments", actual: input.actualInvestment, planned: monthlyDollars(input.reallocation?.investments) },
  ];

  return categories.map(category => ({
    ...category,
    driftPct: category.planned > 0 ? Math.round((Math.abs(category.actual - category.planned) / category.planned) * 100) : 0,
  }));
}

export function getIncomePercentDrifts(input: {
  income: number;
  actualFixed: number;
  actualVariable: number;
  actualInvestment: number;
  reallocation: MonthlyReallocation | undefined;
}): IncomePercentDriftCategory[] {
  const categories = [
    { name: "Fixed", actual: input.actualFixed, planned: monthlyDollars(input.reallocation?.fixedExpenses) },
    { name: "Variable", actual: input.actualVariable, planned: monthlyDollars(input.reallocation?.variableExpenses) },
    { name: "Investments", actual: input.actualInvestment, planned: monthlyDollars(input.reallocation?.investments) },
  ];

  return categories.map(category => {
    const actual = incomePercent(category.actual, input.income);
    const planned = incomePercent(category.planned, input.income);
    return { name: category.name, actual, planned, drift: Math.abs(actual - planned) };
  });
}
