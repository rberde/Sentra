import type { BucketReallocation } from "@/lib/types";

export function monthlyPlanAmount(
  reallocation: Partial<BucketReallocation> | undefined,
  key: keyof BucketReallocation,
): number {
  const amount = reallocation?.[key];
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount as number)) : 0;
}

export function percentOfIncome(amount: number, monthlyIncome: number): number {
  return monthlyIncome > 0 ? Math.round((amount / monthlyIncome) * 100) : 0;
}
