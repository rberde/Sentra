/**
 * Pure spending-cap evaluation used by client agent checks and server monitors.
 * Plan budgets are dollar amounts from monthlyReallocation.variableExpenses.
 */

export type SpendingCapSeverity = "urgent" | "warning";

export interface SpendingCapBreach {
  overByPct: number | null;
  severity: SpendingCapSeverity;
}

/**
 * Returns a breach when actual variable spending exceeds the plan budget
 * (scaled by thresholdPct). A $0 crisis budget is a hard cap: any positive
 * spending is urgent. Never divides by a zero budget.
 */
export function evaluateSpendingCapBreach({
  planBudget,
  actualSpending,
  thresholdPct = 100,
}: {
  planBudget: number;
  actualSpending: number;
  thresholdPct?: number;
}): SpendingCapBreach | null {
  const budget = Number.isFinite(planBudget) ? planBudget : 0;
  const actual = Number.isFinite(actualSpending) ? actualSpending : 0;

  if (budget <= 0) {
    if (actual <= 0) return null;
    return { overByPct: null, severity: "urgent" };
  }

  const threshold = Number.isFinite(thresholdPct) ? thresholdPct : 100;
  const cap = budget * (threshold / 100);
  if (actual <= cap) return null;

  const overByPct = Math.round(((actual - budget) / budget) * 100);
  return {
    overByPct,
    severity: overByPct > 50 ? "urgent" : "warning",
  };
}

export function formatSpendingCapMessage(
  actualSpending: number,
  planBudget: number,
  breach: SpendingCapBreach,
): string {
  const actualLabel = `$${Math.round(actualSpending).toLocaleString()}`;
  const budgetLabel = `$${Math.round(Math.max(0, planBudget)).toLocaleString()}`;

  if (planBudget <= 0) {
    return `Your variable spending (${actualLabel}/mo) exceeds your plan budget of ${budgetLabel}/mo. Your active crisis plan allows no variable spending — review purchases or adjust the plan.`;
  }

  const overBy = breach.overByPct ?? 0;
  return `Your variable spending (${actualLabel}/mo) is ${overBy}% over your plan budget of ${budgetLabel}/mo. Consider reviewing your spending or adjusting your plan.`;
}

/**
 * Server/n8n helper: percent of plan budget used, and whether to alert.
 * When the plan budget is $0, any positive spend is 100%+ over and alerts.
 */
export function calculateSpendingCapUsage({
  planBudget,
  actualSpending,
  thresholdPct = 100,
}: {
  planBudget: number;
  actualSpending: number;
  thresholdPct?: number;
}): { variableCap: number; percentUsed: number; alert: boolean } {
  const variableCap = Number.isFinite(planBudget) ? Math.max(0, planBudget) : 0;
  const actual = Number.isFinite(actualSpending) ? actualSpending : 0;
  const threshold = Number.isFinite(thresholdPct) ? thresholdPct : 100;

  if (variableCap <= 0) {
    const over = actual > 0;
    return {
      variableCap: 0,
      percentUsed: over ? 100 : 0,
      alert: over,
    };
  }

  const percentUsed = Math.round((actual / variableCap) * 100);
  return {
    variableCap,
    percentUsed,
    alert: percentUsed >= threshold,
  };
}
