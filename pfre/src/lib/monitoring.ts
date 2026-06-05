export interface SpendingMonitorResult {
  variableCap: number;
  actualSpending: number;
  percentUsed: number;
  threshold: number;
  alert: boolean;
  alertLevel: "critical" | "warning" | null;
}

export interface DriftCategory {
  name: string;
  actual: number;
  planned: number;
  actualPct: number;
  plannedPct: number;
  driftPct: number;
}

export function calculateSpendingMonitor(
  actualSpending: number,
  plannedVariableBudget: number,
  threshold: number = 100,
): SpendingMonitorResult {
  const variableCap = Math.max(0, Math.round(plannedVariableBudget));
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;
  const alert = percentUsed >= threshold;

  return {
    variableCap,
    actualSpending,
    percentUsed,
    threshold,
    alert,
    alertLevel: alert ? (percentUsed >= 120 ? "critical" : "warning") : null,
  };
}

function percentOfIncome(amount: number, income: number): number {
  return income > 0 ? (amount / income) * 100 : 0;
}

export function calculateDriftCategories(
  income: number,
  categories: Array<{ name: string; actual: number; planned: number }>,
): DriftCategory[] {
  return categories.map(category => {
    const actualPct = percentOfIncome(category.actual, income);
    const plannedPct = percentOfIncome(category.planned, income);

    return {
      ...category,
      actual: Math.round(category.actual),
      planned: Math.round(category.planned),
      actualPct: Math.round(actualPct),
      plannedPct: Math.round(plannedPct),
      driftPct: Math.round(Math.abs(actualPct - plannedPct)),
    };
  });
}
