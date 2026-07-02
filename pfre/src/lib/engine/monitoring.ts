interface SpendingMonitorInput {
  actualSpending: number;
  planBudget: number | null | undefined;
  thresholdPercent?: number | null;
}

export function calculateSpendingMonitor({
  actualSpending,
  planBudget,
  thresholdPercent,
}: SpendingMonitorInput) {
  const variableCap = Math.max(0, Math.round(planBudget ?? 0));
  const percentUsed = variableCap > 0 ? Math.round((actualSpending / variableCap) * 100) : 0;
  const threshold = thresholdPercent ?? 100;
  const alert = variableCap > 0 && percentUsed >= threshold;

  return {
    variableCap,
    percentUsed,
    threshold,
    alert,
    alertLevel: alert ? (percentUsed >= 120 ? "critical" : "warning") : null,
  };
}

export interface DriftCategory {
  name: string;
  actual: number;
  planned: number;
  driftPct: number;
}

interface DriftCategoryInput {
  name: string;
  actual: number;
  planned: number | null | undefined;
}

export function calculateDriftCategories(categories: DriftCategoryInput[]): DriftCategory[] {
  return categories.map(({ name, actual, planned }) => {
    const roundedActual = Math.max(0, Math.round(actual));
    const roundedPlanned = Math.max(0, Math.round(planned ?? 0));
    const driftPct = roundedPlanned > 0
      ? Math.round((Math.abs(roundedActual - roundedPlanned) / roundedPlanned) * 100)
      : roundedActual > 0 ? 100 : 0;

    return {
      name,
      actual: roundedActual,
      planned: roundedPlanned,
      driftPct,
    };
  });
}

export function getOverallDrift(categories: DriftCategory[]) {
  return categories.length > 0 ? Math.max(...categories.map(c => c.driftPct)) : 0;
}
