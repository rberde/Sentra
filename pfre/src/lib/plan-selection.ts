import type { RebalancingPlan } from "@/lib/types";

export function reconcileSelectedPlanId(
  selectedPlanId: string | null,
  plans: Pick<RebalancingPlan, "id">[],
): string | null {
  if (!selectedPlanId) return null;
  return plans.some(plan => plan.id === selectedPlanId) ? selectedPlanId : null;
}
