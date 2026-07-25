/**
 * Resolve when an active plan "started" for scheduled check-in math.
 *
 * Plans should carry `createdAt`. Older synced snapshots may omit it; in that
 * case fall back to lastSyncedAt. Never fall back to "now" — that would make
 * daysSince always 0 and permanently suppress due check-ins.
 */
export function resolvePlanStartAt(
  planCreatedAt: string | null | undefined,
  lastSyncedAt: string | null | undefined,
): string | null {
  const planStart = typeof planCreatedAt === "string" && planCreatedAt.trim() ? planCreatedAt : null;
  if (planStart) return planStart;
  const synced = typeof lastSyncedAt === "string" && lastSyncedAt.trim() ? lastSyncedAt : null;
  return synced;
}

export function daysSincePlanStart(
  planCreatedAt: string | null | undefined,
  lastSyncedAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  const start = resolvePlanStartAt(planCreatedAt, lastSyncedAt);
  if (!start) return null;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return null;
  return Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24));
}

export function isCheckinDue(
  planCreatedAt: string | null | undefined,
  lastSyncedAt: string | null | undefined,
  intervalDays: number,
  nowMs: number = Date.now(),
): { due: boolean; daysSince: number | null; intervalDays: number } {
  const daysSince = daysSincePlanStart(planCreatedAt, lastSyncedAt, nowMs);
  if (daysSince === null) {
    return { due: false, daysSince: null, intervalDays };
  }
  return { due: daysSince >= intervalDays, daysSince, intervalDays };
}
