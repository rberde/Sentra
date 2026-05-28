export interface ReallocationAmounts {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
}

export interface AllocationDriftInput {
  income: number;
  actualFixed: number;
  actualVariable: number;
  actualInvestment: number;
  reallocation: ReallocationAmounts;
}

export interface AllocationDriftCategory {
  key: "fixedExpenses" | "variableExpenses" | "investments";
  name: string;
  actualPct: number;
  plannedPct: number;
  driftPct: number;
}

export function getVariableSpendingCap(reallocation: ReallocationAmounts | undefined): number {
  return Math.round(Math.max(0, reallocation?.variableExpenses ?? 0));
}

export function getPercentUsed(actual: number, cap: number): number {
  return cap > 0 ? Math.round((actual / cap) * 100) : 0;
}

function asIncomePercent(amount: number, income: number): number {
  return income > 0 ? (amount / income) * 100 : 0;
}

export function getAllocationDriftCategories(input: AllocationDriftInput): AllocationDriftCategory[] {
  const categories = [
    {
      key: "fixedExpenses" as const,
      name: "Fixed Expenses",
      actualAmount: input.actualFixed,
      plannedAmount: input.reallocation.fixedExpenses ?? 0,
    },
    {
      key: "variableExpenses" as const,
      name: "Variable Expenses",
      actualAmount: input.actualVariable,
      plannedAmount: input.reallocation.variableExpenses ?? 0,
    },
    {
      key: "investments" as const,
      name: "Investments",
      actualAmount: input.actualInvestment,
      plannedAmount: input.reallocation.investments ?? 0,
    },
  ];

  return categories.map(category => {
    const actualPct = asIncomePercent(category.actualAmount, input.income);
    const plannedPct = asIncomePercent(category.plannedAmount, input.income);

    return {
      key: category.key,
      name: category.name,
      actualPct: Math.round(actualPct),
      plannedPct: Math.round(plannedPct),
      driftPct: Math.round(Math.abs(actualPct - plannedPct)),
    };
  });
}
