type ReallocationLike = Record<string, unknown> | null | undefined;
type RuleLike = Record<string, unknown> | null | undefined;
type StateLike = Record<string, unknown> | null | undefined;

export type BudgetCategory =
  | "fixedExpenses"
  | "variableExpenses"
  | "investments"
  | "savingsGoal"
  | "cashBuffer";

export function amountFromReallocation(
  reallocation: ReallocationLike,
  category: BudgetCategory,
): number {
  const value = reallocation?.[category];
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

export function percentageOfIncome(amount: number, income: number): number {
  return income > 0 ? Math.round((amount / income) * 100) : 0;
}

export function percentUsed(actualAmount: number, budgetAmount: number): number {
  return budgetAmount > 0 ? Math.round((actualAmount / budgetAmount) * 100) : 0;
}

export function driftPercentPoints(
  actualAmount: number,
  plannedAmount: number,
  income: number,
): number {
  return Math.abs(
    percentageOfIncome(actualAmount, income) - percentageOfIncome(plannedAmount, income),
  );
}

export function numericRuleValue(
  rule: RuleLike,
  field: "threshold" | "intervalDays",
  fallback: number,
): number {
  const value = rule?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function validIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? value : null;
}

function latestMatchingPlanSelection(activePlan: ReallocationLike, state: StateLike): string | null {
  const behavioralProfile = state?.behavioralProfile as Record<string, unknown> | undefined;
  const selections = behavioralProfile?.planSelections as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(selections)) return null;

  const planType = activePlan?.type;
  const matching = selections
    .filter(selection => selection.planType === planType)
    .map(selection => validIso(selection.date))
    .filter((date): date is string => date !== null)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return matching[0] ?? null;
}

function latestScheduledNotification(state: StateLike): string | null {
  const notifications = state?.notifications as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(notifications)) return null;

  const matching = notifications
    .filter(notification => notification.type === "scheduled_checkin")
    .map(notification => validIso(notification.createdAt))
    .filter((date): date is string => date !== null)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return matching[0] ?? null;
}

export function planCheckinReferenceIso(activePlan: ReallocationLike, state: StateLike): string | null {
  return (
    validIso(activePlan?.selectedAt) ??
    latestMatchingPlanSelection(activePlan, state) ??
    latestScheduledNotification(state) ??
    validIso(activePlan?.createdAt)
  );
}

export function daysSinceIso(referenceIso: string | null, now = Date.now()): number {
  if (!referenceIso) return 0;
  return Math.max(0, Math.floor((now - new Date(referenceIso).getTime()) / (1000 * 60 * 60 * 24)));
}
