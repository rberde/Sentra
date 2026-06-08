export interface SpendingEvaluation {
  planBudget: number;
  actualSpending: number;
  percentUsed: number;
  thresholdPct: number;
  alert: boolean;
}

export interface DriftCategory {
  name: string;
  actual: number;
  planned: number;
  driftPct: number;
}

const LEGACY_DOLLAR_THRESHOLD_CUTOFF = 500;

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function validIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Number.isFinite(new Date(value).getTime()) ? value : null;
}

export function normalizeSpendingThresholdPct(value: unknown): number {
  const threshold = finiteNumber(value, 100);
  if (threshold <= 0) return 100;

  // Older AI-generated spending rules stored the dollar budget in this field.
  // Treat obviously non-percent values as the intended "100% of plan budget".
  if (threshold > LEGACY_DOLLAR_THRESHOLD_CUTOFF) return 100;

  return threshold;
}

export function evaluateSpendingBudget(
  actualSpending: number,
  planBudget: number,
  threshold: unknown,
): SpendingEvaluation {
  const safePlanBudget = Math.max(0, Math.round(finiteNumber(planBudget)));
  const safeActual = Math.max(0, Math.round(finiteNumber(actualSpending)));
  const thresholdPct = normalizeSpendingThresholdPct(threshold);
  const percentUsed = safePlanBudget > 0 ? Math.round((safeActual / safePlanBudget) * 100) : 0;

  return {
    planBudget: safePlanBudget,
    actualSpending: safeActual,
    percentUsed,
    thresholdPct,
    alert: safePlanBudget > 0 && percentUsed >= thresholdPct,
  };
}

export function calculateDollarDrift(name: string, actual: number, planned: number): DriftCategory {
  const safeActual = Math.max(0, Math.round(finiteNumber(actual)));
  const safePlanned = Math.max(0, Math.round(finiteNumber(planned)));

  return {
    name,
    actual: safeActual,
    planned: safePlanned,
    driftPct: safePlanned > 0 ? Math.round((Math.abs(safeActual - safePlanned) / safePlanned) * 100) : 0,
  };
}

export function getPlanActivationTimestamp(
  activePlan: Record<string, unknown>,
  state: Record<string, unknown>,
): string | null {
  const explicit = validIsoTimestamp(activePlan.activatedAt) ?? validIsoTimestamp(activePlan.createdAt);
  if (explicit) return explicit;

  const planSelections = ((state.behavioralProfile as Record<string, unknown> | undefined)?.planSelections ?? []) as Array<Record<string, unknown>>;
  const matchingSelection = planSelections
    .filter(selection => selection.planType === activePlan.type)
    .map(selection => validIsoTimestamp(selection.date))
    .filter((date): date is string => date !== null)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  if (matchingSelection) return matchingSelection;

  const notifications = (state.notifications ?? []) as Array<Record<string, unknown>>;
  return notifications
    .filter(notification => notification.title === "Plan Activated")
    .map(notification => validIsoTimestamp(notification.createdAt))
    .filter((date): date is string => date !== null)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

export function daysSinceTimestamp(timestamp: string | null, now = Date.now()): number {
  if (!timestamp) return 0;
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor((now - parsed) / (1000 * 60 * 60 * 24)));
}
