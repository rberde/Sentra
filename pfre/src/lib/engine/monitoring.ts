type MonthlyReallocation = {
  fixedExpenses?: number;
  variableExpenses?: number;
  investments?: number;
};

type AllocationKey = keyof MonthlyReallocation;

function safeAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

export function monthlyPlanAmount(reallocation: MonthlyReallocation | undefined, key: AllocationKey): number {
  return safeAmount(reallocation?.[key]);
}

export function percentOfIncome(amount: number, income: number): number {
  const safeIncome = safeAmount(income);
  return safeIncome > 0 ? (safeAmount(amount) / safeIncome) * 100 : 0;
}

export function calculateSpendingUsage(params: {
  actualSpending: number;
  reallocation: MonthlyReallocation | undefined;
  threshold?: number;
}) {
  const variableCap = monthlyPlanAmount(params.reallocation, "variableExpenses");
  const actualSpending = safeAmount(params.actualSpending);
  const threshold = safeAmount(params.threshold ?? 100);
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;

  return {
    variableCap,
    actualSpending,
    percentUsed,
    threshold,
    alert: percentUsed >= threshold,
  };
}

export function calculateAllocationDrift(params: {
  income: number;
  actualFixed: number;
  actualVariable: number;
  actualInvestment: number;
  reallocation: MonthlyReallocation | undefined;
  threshold?: number;
}) {
  const threshold = safeAmount(params.threshold ?? 10);
  const categories = [
    {
      key: "fixedExpenses" as const,
      name: "Fixed Expenses",
      actualAmount: safeAmount(params.actualFixed),
      plannedAmount: monthlyPlanAmount(params.reallocation, "fixedExpenses"),
    },
    {
      key: "variableExpenses" as const,
      name: "Variable Expenses",
      actualAmount: safeAmount(params.actualVariable),
      plannedAmount: monthlyPlanAmount(params.reallocation, "variableExpenses"),
    },
    {
      key: "investments" as const,
      name: "Investments",
      actualAmount: safeAmount(params.actualInvestment),
      plannedAmount: monthlyPlanAmount(params.reallocation, "investments"),
    },
  ].map(category => {
    const actualPct = roundPercent(percentOfIncome(category.actualAmount, params.income));
    const plannedPct = roundPercent(percentOfIncome(category.plannedAmount, params.income));

    return {
      ...category,
      actualPct,
      plannedPct,
      driftPct: roundPercent(Math.abs(actualPct - plannedPct)),
    };
  });

  const overallDrift = Math.max(...categories.map(category => category.driftPct));

  return {
    categories,
    overallDrift,
    threshold,
    alert: overallDrift > threshold,
  };
}
